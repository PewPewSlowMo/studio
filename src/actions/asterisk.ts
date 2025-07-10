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
    data?: CallState;
    error?: string;
}> {
    // Helper function to map raw states to application-specific states
    const mapEndpointState = (rawState: string | undefined): CallState['status'] => {
        const state = rawState?.toLowerCase() || 'unavailable';
        switch (state) {
            case 'not in use': return 'available';
            case 'dnd': return 'dnd';
            case 'unavailable': return 'offline';
            case 'invalid': return 'offline';
            case 'ringing': return 'ringing';
            case 'in use': return 'on-call';
            case 'busy': return 'on-call';
            default: return 'offline'; // Fallback for any other state
        }
    };

    // 1. Get the primary source of truth: the endpoint's state.
    const endpointResult = await getAriEndpointDetails(connection, extension);
    if (!endpointResult.success || !endpointResult.data) {
        return { success: false, error: endpointResult.error || `Could not get endpoint details for ${extension}.` };
    }
    const endpoint = endpointResult.data;
    
    // 2. Determine the base status from the endpoint.
    const baseStatus = mapEndpointState(endpoint.state);
    let finalCallState: CallState = {
        status: baseStatus,
        endpointState: baseStatus,
        extension: extension,
    };

    // 3. If the endpoint has channels, it's in a call. Enhance with call details.
    const operatorChannelId = endpoint.channel_ids.length > 0 ? endpoint.channel_ids[0] : undefined;
    if (operatorChannelId) {
        const operatorChannelResult = await fetchFromAri(
            connection,
            `channels/${operatorChannelId}`,
            AriChannelSchema
        );
        
        // If we can get channel details, override status and add call info
        if (operatorChannelResult.success && operatorChannelResult.data) {
            const operatorChannel = operatorChannelResult.data;
            
            // Channel state is more precise during a call
            finalCallState.status = mapEndpointState(operatorChannel.state);
            finalCallState.channelId = operatorChannelId;
            finalCallState.channelName = operatorChannel.name;
            finalCallState.queue = operatorChannel.dialplan?.context;

            // --- Advanced Caller ID and UniqueID retrieval logic ---
            let effectiveCallerId: string | undefined = undefined;
            let mainUniqueId: string | undefined = undefined;

            // Method 1: Bridge lookup (most reliable for connected calls)
            const bridgeId = operatorChannel.bridge_ids?.[0];
            if (bridgeId) {
                const bridgeResult = await fetchFromAri(connection, `bridges/${bridgeId}`, AriBridgeSchema);
                if (bridgeResult.success && bridgeResult.data) {
                    const peerChannelId = bridgeResult.data.channels.find(id => id !== operatorChannelId);
                    if (peerChannelId) {
                        const peerChannelResult = await fetchFromAri(connection, `channels/${peerChannelId}`, AriChannelSchema);
                        if (peerChannelResult.success && peerChannelResult.data) {
                            effectiveCallerId = peerChannelResult.data.caller.number;
                            const peerUniqueIdResult = await getAriChannelVar(connection, peerChannelId, 'CDR(uniqueid)');
                            if (peerUniqueIdResult.success) mainUniqueId = peerUniqueIdResult.data?.value;
                        }
                    }
                }
            }

            // Fallback Method 2: CONNECTEDLINE variable
            if (!effectiveCallerId) {
                const connectedLineResult = await getAriChannelVar(connection, operatorChannelId, 'CONNECTEDLINE(num)');
                if (connectedLineResult.success) effectiveCallerId = connectedLineResult.data?.value;
            }
            
            // Fallback Method 3: Call creator
            if (!effectiveCallerId && operatorChannel.creator) {
                 const creatorChannelResult = await fetchFromAri(connection, `channels/${operatorChannel.creator}`, AriChannelSchema);
                 if (creatorChannelResult.success && creatorChannelResult.data) {
                    effectiveCallerId = creatorChannelResult.data.caller.number;
                }
            }

            // Fallback for UniqueID: linkedid, then own uniqueid
            if (!mainUniqueId) {
                const linkedIdResult = await getAriChannelVar(connection, operatorChannelId, 'CDR(linkedid)');
                if (linkedIdResult.success) mainUniqueId = linkedIdResult.data?.value;
            }
            if (!mainUniqueId) {
                const ownUniqueIdResult = await getAriChannelVar(connection, operatorChannelId, 'CDR(uniqueid)');
                if (ownUniqueIdResult.success) mainUniqueId = ownUniqueIdResult.data?.value;
            }

            finalCallState.callerId = effectiveCallerId;
            finalCallState.uniqueId = mainUniqueId;
        }
    }
    
    // 4. Return the final, determined state.
    // This will either be the base endpoint status (if no call) or the enhanced status (if in a call).
    return { success: true, data: finalCallState };
}
