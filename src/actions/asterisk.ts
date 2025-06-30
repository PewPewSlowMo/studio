'use server';

import { z } from 'zod';
import type { AsteriskEndpoint } from '@/lib/types';

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
        uniqueId?: string;
    };
    error?: string;
}> {
    // 1. Get endpoint details to find the operator's active channel
    const endpointResult = await getAriEndpointDetails(connection, extension);
    if (!endpointResult.success || !endpointResult.data) {
        return { success: false, error: endpointResult.error || 'Could not get endpoint details.' };
    }
    const endpoint = endpointResult.data;
    
    // If no active channel, just return the basic endpoint state (e.g., 'available', 'offline')
    const operatorChannelId = endpoint.channel_ids.length > 0 ? endpoint.channel_ids[0] : undefined;
    if (!operatorChannelId) {
        return { 
            success: true, 
            data: { 
                endpointState: endpoint.state 
            } 
        };
    }

    // 2. Get the operator's channel details
    const operatorChannelResult = await fetchFromAri(
        connection,
        `channels/${operatorChannelId}`,
        AriChannelSchema
    );

    if (!operatorChannelResult.success || !operatorChannelResult.data) {
        // Fallback to endpoint state if channel somehow disappeared between calls
        return { success: true, data: { endpointState: endpoint.state } };
    }
    const operatorChannel = operatorChannelResult.data;

    // Set default/fallback values from the operator's channel itself
    let effectiveCallerId = operatorChannel.caller.number;
    let uniqueId = operatorChannel.id; // Start with the wrong one as a last resort
    let queue = operatorChannel.dialplan?.context;
    
    // This will hold the ID of the channel that initiated the call to the operator
    let initiatingChannelId: string | undefined = undefined;

    // 3. The "Creator" Method (NEW PRIMARY): The most reliable way to find the original channel.
    // The creator of the operator's channel IS the original caller's channel.
    if (operatorChannel.creator) {
        initiatingChannelId = operatorChannel.creator;
    }

    // 4. The "Bridge" Method (FALLBACK): If creator is not found, try to find the peer in the bridge.
    // This is useful for established calls or different dialplan configurations.
    if (!initiatingChannelId) {
        const bridgeId = operatorChannel.bridge_ids?.[0];
        if (bridgeId) {
            const bridgeResult = await fetchFromAri(
                connection,
                `bridges/${bridgeId}`,
                AriBridgeSchema
            );
            if (bridgeResult.success && bridgeResult.data) {
                const otherChannelId = bridgeResult.data.channels.find(
                    (id) => id !== operatorChannelId
                );
                if (otherChannelId) {
                    initiatingChannelId = otherChannelId;
                }
            }
        }
    }

    // 5. If we found the initiating channel (by creator or bridge), get its details.
    // This is the source of truth for the CDR `uniqueid` and the real caller ID.
    if (initiatingChannelId) {
        const callerChannelResult = await fetchFromAri(
            connection,
            `channels/${initiatingChannelId}`,
            AriChannelSchema
        );
        if (callerChannelResult.success && callerChannelResult.data) {
            const callerChannel = callerChannelResult.data;
            // This is the correct data we need for CDR matching and display.
            uniqueId = callerChannel.id; // This is the uniqueid that will be in the CDR log.
            effectiveCallerId = callerChannel.caller.number;
            queue = callerChannel.dialplan?.context || queue;
        }
    }
    
    // Determine the final status based on channel/endpoint states
    const stateToUse = operatorChannel.state || endpoint.state;
    const normalizedState = stateToUse?.toLowerCase();
    let status: string = 'offline';
    
    switch (normalizedState) {
        case 'ring':
        case 'ringing':
            status = 'ringing';
            break;
        case 'up': case 'busy': case 'offhook': case 'dialing':
            status = 'on-call';
            break;
        case 'down': case 'rsrvd': case 'online': case 'not_inuse': case 'not in use':
            status = 'available';
            break;
        case 'unavailable': case 'invalid': case 'offline':
            status = 'offline';
            break;
        default:
            status = operatorChannelId ? 'on-call' : 'available';
    }
    
    return {
        success: true,
        data: {
            endpointState: status, // Return the unified status
            channelId: operatorChannelId,
            channelName: operatorChannel.name,
            channelState: operatorChannel.state,
            queue: queue,
            callerId: effectiveCallerId, 
            uniqueId: uniqueId,
        },
    };
}
