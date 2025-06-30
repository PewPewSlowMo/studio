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
    // 1. Get endpoint details
    const endpointResult = await getAriEndpointDetails(connection, extension);
    if (!endpointResult.success || !endpointResult.data) {
        return { success: false, error: endpointResult.error || `Could not get endpoint details for ${extension}.` };
    }
    const endpoint = endpointResult.data;
    
    const operatorChannelId = endpoint.channel_ids.length > 0 ? endpoint.channel_ids[0] : undefined;
    if (!operatorChannelId) {
        const status = (endpoint.state === 'unavailable' || endpoint.state === 'invalid') ? 'offline' : 'available';
        return { success: true, data: { endpointState: status } };
    }

    // 2. Get the operator's channel details
    const operatorChannelResult = await fetchFromAri(
        connection,
        `channels/${operatorChannelId}`,
        AriChannelSchema
    );

    if (!operatorChannelResult.success || !operatorChannelResult.data) {
        const status = (endpoint.state === 'unavailable' || endpoint.state === 'invalid') ? 'offline' : 'available';
        return { success: true, data: { endpointState: status } };
    }
    const operatorChannel = operatorChannelResult.data;

    // --- New, more robust data extraction ---
    
    // 3. Get the correct UniqueID for saving. The `CDR(linkedid)` on the operator's channel
    // points to the `CDR(uniqueid)` of the caller's channel. This is the most reliable.
    const linkedIdResult = await getAriChannelVar(connection, operatorChannelId, 'CDR(linkedid)');
    let uniqueId = linkedIdResult.success ? linkedIdResult.data?.value : undefined;

    // If there is no `linkedid` (e.g., a direct call), use the operator's own `uniqueid`.
    if (!uniqueId || uniqueId === '') {
        const cdrUniqueIdResult = await getAriChannelVar(connection, operatorChannelId, 'CDR(uniqueid)');
        uniqueId = cdrUniqueIdResult.success ? cdrUniqueIdResult.data?.value : undefined;
    }


    // 4. Get the Caller ID using a hierarchy of reliability.
    let effectiveCallerId: string | undefined = undefined;
    // Priority 1: Use the custom variable set by the dialplan.
    const crmSourceVarResult = await getAriChannelVar(connection, operatorChannelId, '__CRM_SOURCE');
    if (crmSourceVarResult.success && crmSourceVarResult.data?.value) {
        effectiveCallerId = crmSourceVarResult.data.value;
    } else {
        // Priority 2: Use the linked channel's details.
        // The channel ID of the other party is often the same as the linkedid.
        if (linkedIdResult.success && linkedIdResult.data?.value) {
             const callerChannelResult = await fetchFromAri(connection, `channels/${linkedIdResult.data.value}`, AriChannelSchema);
             if (callerChannelResult.success && callerChannelResult.data) {
                effectiveCallerId = callerChannelResult.data.caller.number;
             }
        }
        // Priority 3: Fallback to creator channel if linked channel fails.
        if (!effectiveCallerId && operatorChannel.creator) {
            const creatorChannelResult = await fetchFromAri(connection, `channels/${operatorChannel.creator}`, AriChannelSchema);
            if (creatorChannelResult.success && creatorChannelResult.data) {
                effectiveCallerId = creatorChannelResult.data.caller.number;
            }
        }
    }
    
    // Last resort: If still no ID, use the one from the operator's channel itself.
    if (!effectiveCallerId) {
        effectiveCallerId = operatorChannel.caller.number;
    }

    // 5. Get other details
    const queue = operatorChannel.dialplan?.context;

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
