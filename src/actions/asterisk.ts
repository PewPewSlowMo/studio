'use server';

import { z } from 'zod';
import type { AsteriskEndpoint, CallState as OperatorCallState } from '@/lib/types';

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
    };
    error?: string;
}> {
    const endpointResult = await getAriEndpointDetails(connection, extension);

    if (!endpointResult.success || !endpointResult.data) {
        return { success: false, error: endpointResult.error || 'Could not get endpoint details.' };
    }
    const endpoint = endpointResult.data;
    
    const channelId = endpoint.channel_ids.length > 0 ? endpoint.channel_ids[0] : undefined;

    if (!channelId) {
        return { 
            success: true, 
            data: { 
                endpointState: endpoint.state 
            } 
        };
    }

    const operatorChannelResult = await fetchFromAri(
        connection,
        `channels/${channelId}`,
        AriChannelSchema
    );

    if (!operatorChannelResult.success || !operatorChannelResult.data) {
        return { success: true, data: { endpointState: endpoint.state } }; // Fallback
    }

    const operatorChannel = operatorChannelResult.data;
    let effectiveCallerId = operatorChannel.caller.number; // Fallback value

    const baseData = {
        endpointState: endpoint.state,
        channelId: channelId,
        channelName: operatorChannel.name,
        channelState: operatorChannel.state,
        queue: operatorChannel.dialplan?.context,
    };

    // New Strategy: Find caller via the bridge
    if (operatorChannel.bridge_ids && operatorChannel.bridge_ids.length > 0) {
        const bridgeId = operatorChannel.bridge_ids[0];
        const bridgeResult = await fetchFromAri(connection, `bridges/${bridgeId}`, AriBridgeSchema);

        if (bridgeResult.success && bridgeResult.data) {
            const otherChannelId = bridgeResult.data.channels.find(c => c !== channelId);
            if (otherChannelId) {
                const otherChannelResult = await fetchFromAri(connection, `channels/${otherChannelId}`, AriChannelSchema);
                if (otherChannelResult.success && otherChannelResult.data) {
                    // This is the real caller's channel
                    effectiveCallerId = otherChannelResult.data.caller.number;
                     return {
                        success: true,
                        data: {
                            ...baseData,
                            callerId: effectiveCallerId,
                        },
                    };
                }
            }
        }
    }
    
    // Fallback Strategy: If bridge fails, check CALLERID(num) variable
    const callerIdNumResult = await fetchFromAri(
        connection,
        `channels/${channelId}/variable?variable=CALLERID(num)`,
        AriChannelVarSchema
    );
    
    if (callerIdNumResult.success && callerIdNumResult.data?.value) {
        effectiveCallerId = callerIdNumResult.data.value;
    }

    let newStatus: OperatorCallState['status'] = 'offline';
    const stateToUse = operatorChannel.state?.toLowerCase();
            
    switch (stateToUse) {
        case 'ring':
        case 'ringing':
            newStatus = 'ringing';
            break;
        case 'up': case 'busy': case 'offhook': case 'dialing':
            newStatus = 'on-call';
            break;
        case 'down': case 'rsrvd': case 'online': case 'not_inuse': case 'not in use':
            newStatus = 'available';
            break;
        case 'unavailable': case 'invalid': case 'offline':
            newStatus = 'offline';
            break;
        default:
            newStatus = channelId ? 'on-call' : 'available';
    }


    return {
        success: true,
        data: {
            ...baseData,
            callerId: effectiveCallerId,
        },
    };
}
