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

    // --- Data Extraction: Start with fallbacks from operator's own channel ---
    let effectiveCallerId = operatorChannel.caller.number;
    let uniqueId = operatorChannel.id; // This is the ID of the operator's leg of the call
    let queue = operatorChannel.dialplan?.context;
    
    // --- Find the Initiating Channel (the real caller) ---
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
            // Find the channel in the bridge that is NOT the operator's channel
            initiatingChannelId = bridgeResult.data.channels.find(
                (id) => id !== operatorChannelId
            );
        }
    }

    // --- Get Details from the Initiating Channel if found ---
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
    
    // --- Determine Final Status ---
    // The status is determined by the operator's own channel/endpoint state.
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
        case 'busy': // This state is often on the endpoint, not the channel
        case 'onhook': // Not a standard ARI state, but good to have
            finalStatus = 'on-call';
            break;
        case 'down':
        case 'rsrvd':
        case 'not_inuse':
        case 'not in use': // PJSIPShowEndpoint can return this
             finalStatus = 'available';
             break;
        case 'unavailable':
        case 'invalid':
            finalStatus = 'offline';
            break;
        default:
             // If we have a channel, it's very likely an active call or ringing.
             // If we don't, but the endpoint is not unavailable, then it's available.
             if (operatorChannelId) {
                 finalStatus = 'on-call';
             } else {
                 finalStatus = (endpoint.state === 'unavailable' || endpoint.state === 'invalid') ? 'offline' : 'available';
             }
    }

    // Special case: If endpoint is 'busy' this should override channel state to be 'on-call'
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
