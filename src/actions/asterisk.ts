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
        uniqueId?: string;
    };
    error?: string;
}> {
    // 1. Get endpoint details
    const endpointResult = await getAriEndpointDetails(connection, extension);
    if (!endpointResult.success || !endpointResult.data) {
        return { success: false, error: endpointResult.error || `Could not get endpoint details for ${extension}.` };
    }
    const endpoint = endpointResult.data;
    
    // If no active channel, operator is available or offline based on endpoint state
    const operatorChannelId = endpoint.channel_ids.length > 0 ? endpoint.channel_ids[0] : undefined;
    if (!operatorChannelId) {
        const status = (endpoint.state === 'unavailable' || endpoint.state === 'invalid') ? 'offline' : 'available';
        return { 
            success: true, 
            data: { 
                endpointState: status 
            } 
        };
    }

    // 2. Get the operator's channel details
    const operatorChannelResult = await fetchFromAri(
        connection,
        `channels/${operatorChannelId}`,
        AriChannelSchema
    );

    // If channel has disappeared, fall back to endpoint state
    if (!operatorChannelResult.success || !operatorChannelResult.data) {
        const status = (endpoint.state === 'unavailable' || endpoint.state === 'invalid') ? 'offline' : 'available';
        return { success: true, data: { endpointState: status } };
    }
    const operatorChannel = operatorChannelResult.data;

    // --- Data Extraction ---
    let effectiveCallerId = operatorChannel.caller.number;
    let uniqueId = operatorChannel.id;
    let queue = operatorChannel.dialplan?.context;

    // --- Find the Initiating Channel (the real caller) to get correct UniqueID and fallback CallerID
    let initiatingChannelId: string | undefined = undefined;

    // Method A (Primary): Use the 'creator' field. It's the most direct link.
    if (operatorChannel.creator) {
        initiatingChannelId = operatorChannel.creator;
    }
    // Method B (Fallback): If no creator, find the peer in the bridge.
    else if (operatorChannel.bridge_ids && operatorChannel.bridge_ids.length > 0) {
        const bridgeId = operatorChannel.bridge_ids[0];
        const bridgeResult = await fetchFromAri(
            connection,
            `bridges/${bridgeId}`,
            AriBridgeSchema
        );
        if (bridgeResult.success && bridgeResult.data) {
            initiatingChannelId = bridgeResult.data.channels.find(
                (id) => id !== operatorChannelId
            );
        }
    }
    
    // Primary Method for Caller ID: Check for __CRM_SOURCE on operator's channel
    const crmSourceVarResult = await getAriChannelVar(connection, operatorChannelId, '__CRM_SOURCE');
    if (crmSourceVarResult.success && crmSourceVarResult.data?.value) {
        effectiveCallerId = crmSourceVarResult.data.value;
    }

    // Get Details from the Initiating Channel if found
    if (initiatingChannelId) {
        const callerChannelResult = await fetchFromAri(
            connection,
            `channels/${initiatingChannelId}`,
            AriChannelSchema
        );
        if (callerChannelResult.success && callerChannelResult.data) {
            const callerChannel = callerChannelResult.data;
            uniqueId = callerChannel.id; // This is the uniqueid that will be in the CDR log.
            queue = callerChannel.dialplan?.context || queue;
            // Fallback Caller ID if __CRM_SOURCE was not found
            if (!crmSourceVarResult.success || !crmSourceVarResult.data?.value) {
                effectiveCallerId = callerChannel.caller.number;
            }
        }
    }
    
    // --- Determine Final Status ---
    const stateToUse = operatorChannel.state || endpoint.state;
    const normalizedState = stateToUse?.toLowerCase();
    let finalStatus: CallState['status'] = 'offline';
    
    switch (normalizedState) {
        case 'ring':
        case 'ringing':
            finalStatus = 'ringing';
            break;
        case 'up':
            finalStatus = 'on-call';
            break;
        case 'busy': 
            finalStatus = 'on-call';
            break;
        case 'down':
        case 'rsrvd':
        case 'not_inuse':
        case 'not in use': 
             finalStatus = 'available';
             break;
        case 'unavailable':
        case 'invalid':
            finalStatus = 'offline';
            break;
        default:
             if (operatorChannelId) {
                 finalStatus = 'on-call';
             } else {
                 finalStatus = (endpoint.state === 'unavailable' || endpoint.state === 'invalid') ? 'offline' : 'available';
             }
    }

    if (endpoint.state.toLowerCase() === 'busy') {
        finalStatus = 'on-call';
    }
    
    return {
        success: true,
        data: {
            endpointState: finalStatus,
            channelId: operatorChannelId,
            channelName: operatorChannel.name,
            channelState: operatorChannel.state,
            queue: queue,
            callerId: effectiveCallerId, 
            uniqueId: uniqueId,
        },
    };
}
