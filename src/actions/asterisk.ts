'use server';

import { z } from 'zod';
import type { AsteriskEndpoint, CallState } from '@/lib/types';

const AsteriskInfoSchema = z.object({
  system: z.object({
    version: z.string(),
  }),
});

const AsteriskConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.string().min(1, 'Port is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string(),
});

type AsteriskConnection = z.infer<typeof AsteriskConnectionSchema>;

async function fetchFromAri<T>(
  connection: AsteriskConnection,
  path: string,
  schema: z.ZodType<T>
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const validatedConnection = AsteriskConnectionSchema.parse(connection);
    const { host, port, username, password } = validatedConnection;

    const url = `http://${host}:${port}/ari/${path}`;
    const authToken = Buffer.from(`${username}:${password}`).toString('base64');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      let errorDetails = '';
      try {
        errorDetails = await response.text();
      } catch (e) {
        // Ignore if text body is not available
      }
      return {
        success: false,
        error: `Request failed with status: ${response.status} ${response.statusText}. ${errorDetails}`,
      };
    }

    const data = await response.json();
    const parsedData = schema.safeParse(data);

    if (!parsedData.success) {
      console.error(parsedData.error);
      return {
        success: false,
        error: `Successfully connected, but the response format for ${path} was unexpected.`,
      };
    }

    return { success: true, data: parsedData.data };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: `Invalid input: ${e.errors.map((err) => err.message).join(', ')}` };
    }
    if (e instanceof Error) {
      if (e.message.includes('fetch failed')) {
        return { success: false, error: 'Network error: Could not reach the host. Check the host, port, and network connectivity.' };
      }
      return { success: false, error: e.message };
    }
    return { success: false, error: 'An unknown error occurred.' };
  }
}

export async function getAsteriskVersion(
  connection: AsteriskConnection
): Promise<{ success: boolean; version?: string; error?: string }> {
  const result = await fetchFromAri(connection, 'asterisk/info', AsteriskInfoSchema);
  if (result.success && result.data) {
    return { success: true, version: result.data.system.version };
  }
  return { success: false, error: result.error };
}

// --- Schemas for Operator State ---
const AriEndpointSchema = z.object({
  technology: z.string(),
  resource: z.string(),
  state: z.string(),
  channel_ids: z.array(z.string()),
});

const AriChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
  caller: z.object({ name: z.string(), number: z.string() }),
  connected: z.object({ name: z.string(), number: z.string() }),
  dialplan: z.object({
      context: z.string(),
      exten: z.string(),
      priority: z.number()
  }).optional(),
  bridge_ids: z.array(z.string()).optional(),
  creator: z.string().optional(),
});

const AriBridgeSchema = z.object({
    id: z.string(),
    technology: z.string(),
    bridge_type: z.string(),
    channels: z.array(z.string()),
});


const AriChannelVarSchema = z.object({
  value: z.string(),
});

async function getAriChannelVar(
  connection: AsteriskConnection,
  channelId: string,
  variableName: string
): Promise<{ success: boolean; data?: z.infer<typeof AriChannelVarSchema>; error?: string }> {
  const result = await fetchFromAri(
    connection,
    `channels/${channelId}/variable?variable=${variableName}`,
    AriChannelVarSchema
  );
  return result;
}

export async function getAriEndpointDetails(
  connection: AsteriskConnection,
  extension: string
): Promise<{ success: boolean; data?: AsteriskEndpoint; error?: string }> {
  const result = await fetchFromAri(connection, `endpoints/PJSIP/${extension}`, AriEndpointSchema);
  return result;
}

export async function getOperatorState(
    connection: AsteriskConnection,
    extension: string
): Promise<{
    success: boolean;
    data?: {
        endpointState: string;
        channelId?: string;
        channelName?: string;
        channelState?: string;
        callerId?: string;
        queue?: string;
        uniqueId?: string; // This is the CDR uniqueid
    };
    error?: string;
}> {
    // Helper function to map raw states to application-specific states
    const mapState = (rawState: string): string => {
        const state = rawState.toLowerCase();
        switch (state) {
            case 'not_inuse': return 'available';
            case 'dnd': return 'dnd';
            case 'unavailable':
            case 'invalid': return 'offline';
            case 'ring':
            case 'ringing': return 'ringing';
            case 'up':
            case 'busy': return 'on-call';
            default: return state; // Pass through any other states like 'in use'
        }
    };

    // 1. Get endpoint details
    const endpointResult = await getAriEndpointDetails(connection, extension);
    if (!endpointResult.success || !endpointResult.data) {
        return { success: false, error: endpointResult.error || `Could not get endpoint details for ${extension}.` };
    }
    const endpoint = endpointResult.data;
    
    // The primary channel associated with the operator's device
    const operatorChannelId = endpoint.channel_ids.length > 0 ? endpoint.channel_ids[0] : undefined;
    
    // If there are no channels, the operator is not in a call.
    // The endpoint state is the source of truth.
    if (!operatorChannelId) {
        const finalStatus = mapState(endpoint.state);
        return { success: true, data: { endpointState: finalStatus } };
    }

    // 2. A channel exists, get its details to determine call state
    const operatorChannelResult = await fetchFromAri(
        connection,
        `channels/${operatorChannelId}`,
        AriChannelSchema
    );

    // If channel fetch fails, fallback to endpoint state
    if (!operatorChannelResult.success || !operatorChannelResult.data) {
        return { success: true, data: { endpointState: mapState(endpoint.state) } };
    }
    const operatorChannel = operatorChannelResult.data;

    // --- Data extraction for an active call ---
    let mainUniqueId: string | undefined = undefined;
    let effectiveCallerId: string | undefined = undefined;
    let peerChannelId: string | undefined = undefined;

    // Method 1 (most reliable): Find the peer channel in the bridge to get its details.
    const bridgeId = operatorChannel.bridge_ids?.[0];
    if (bridgeId) {
        const bridgeResult = await fetchFromAri(connection, `bridges/${bridgeId}`, AriBridgeSchema);
        if (bridgeResult.success && bridgeResult.data) {
            peerChannelId = bridgeResult.data.channels.find(id => id !== operatorChannelId);
            if (peerChannelId) {
                const peerUniqueIdResult = await getAriChannelVar(connection, peerChannelId, 'CDR(uniqueid)');
                if (peerUniqueIdResult.success && peerUniqueIdResult.data?.value) {
                    mainUniqueId = peerUniqueIdResult.data.value;
                }
                const peerChannelResult = await fetchFromAri(connection, `channels/${peerChannelId}`, AriChannelSchema);
                if (peerChannelResult.success && peerChannelResult.data) {
                    effectiveCallerId = peerChannelResult.data.caller.number;
                }
            }
        }
    }

    // Fallback methods for caller ID if bridge fails or doesn't exist yet (e.g., ringing)
    if (!effectiveCallerId) {
        const connectedLineResult = await getAriChannelVar(connection, operatorChannelId, 'CONNECTEDLINE(num)');
        if (connectedLineResult.success && connectedLineResult.data?.value) {
            effectiveCallerId = connectedLineResult.data.value;
        }
    }
    if (!effectiveCallerId && operatorChannel.creator) {
        const creatorChannelResult = await fetchFromAri(connection, `channels/${operatorChannel.creator}`, AriChannelSchema);
        if (creatorChannelResult.success && creatorChannelResult.data) {
            effectiveCallerId = creatorChannelResult.data.caller.number;
        }
    }

    // Fallback methods for Unique ID
    if (!mainUniqueId) {
        const linkedIdResult = await getAriChannelVar(connection, operatorChannelId, 'CDR(linkedid)');
        if (linkedIdResult.success && linkedIdResult.data?.value) {
            mainUniqueId = linkedIdResult.data.value;
        } else {
             const ownUniqueIdResult = await getAriChannelVar(connection, operatorChannelId, 'CDR(uniqueid)');
             if (ownUniqueIdResult.success && ownUniqueIdResult.data?.value) {
                mainUniqueId = ownUniqueIdResult.data.value;
            }
        }
    }
    
    // When a channel exists, its state is more accurate than the endpoint's state.
    const finalStatus = mapState(operatorChannel.state);
    
    return {
        success: true,
        data: {
            endpointState: finalStatus,
            channelId: operatorChannelId,
            channelName: operatorChannel.name,
            channelState: operatorChannel.state,
            queue: operatorChannel.dialplan?.context,
            callerId: effectiveCallerId, 
            uniqueId: mainUniqueId,
        },
    };
}
