
'use server';

import { z } from 'zod';
import type { UserRole, CallState } from '@/lib/types';
import { writeToLog } from './logger';

const AriConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.string().min(1, 'Port is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string(),
});

type AriConnection = z.infer<typeof AriConnectionSchema>;

/**
 * A robust fetch wrapper for making requests to the Asterisk REST Interface (ARI).
 */
async function fetchFromAri(connection: AriConnection, path: string, options: RequestInit = {}) {
  const validatedConnection = AriConnectionSchema.parse(connection);
  const { host, port, username, password } = validatedConnection;
  const url = `http://${host}:${port}/ari/${path}`;
  
  const logContext = `ARI Fetch (${options.method || 'GET'})`;
  await writeToLog(logContext, `Requesting URL: ${url}`);

  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  const defaultOptions: RequestInit = {
    headers: {
      'Authorization': `Basic ${auth}`,
      ...options.headers,
    },
    cache: 'no-store',
  };

  try {
    const response = await fetch(url, { ...options, ...defaultOptions });
    
    if (!response.ok) {
        const errorBody = await response.text();
        await writeToLog(logContext, {
            level: 'ERROR',
            url: url,
            status: response.status,
            statusText: response.statusText,
            body: errorBody
        });
    } else {
         await writeToLog(logContext, {
            level: 'INFO',
            url: url,
            status: response.status
        });
    }

    return response;
  } catch (e) {
      if (e instanceof TypeError && e.message.includes('fetch failed')) {
        const errorMessage = `Cannot connect to ARI server at ${host}:${port}`;
        await writeToLog(logContext, { level: 'ERROR', url: url, error: errorMessage, details: e });
        return new Response(JSON.stringify({ message: errorMessage }), { status: 503, statusText: 'Service Unavailable' });
      }
      
      const message = e instanceof Error ? e.message : 'A network or fetch error occurred.';
      await writeToLog(logContext, { level: 'ERROR', url: url, error: message, details: e });
      return new Response(JSON.stringify({ message }), { status: 500, statusText: 'Internal Server Error' });
  }
}

async function getAriChannelVariable(connection: AriConnection, channelId: string, variable: string): Promise<string | null> {
    const response = await fetchFromAri(connection, `channels/${channelId}/variable?variable=${variable}`);
    if (response.status === 404) {
        // This is expected if the channel hung up during polling.
        return null;
    }
    if (!response.ok) {
        return null;
    }
    const result = await response.json();
    return result.value || null;
}

export async function getAriChannelDetails(connection: AriConnection, channelId: string): Promise<any | null> {
    const response = await fetchFromAri(connection, `channels/${channelId}`);
    if (response.status === 404) {
        // Channel hung up, this is not an error, just means the call is over.
        return null;
    }
    if (!response.ok) {
        throw new Error(`Failed to get channel details for ${channelId}: ${response.statusText}`);
    }
    const details = await response.json();

    // Now, try to get the most reliable uniqueid from the channel variables
    const uniqueId = await getAriChannelVariable(connection, channelId, 'CDR(uniqueid)');
    const linkedId = await getAriChannelVariable(connection, channelId, 'CDR(linkedid)');
    const connectedLineNum = await getAriChannelVariable(connection, channelId, 'CONNECTEDLINE(num)');


    return {
        ...details,
        // Prioritize the CDR uniqueid, as it's the one that will be in the DB.
        // Fall back to other IDs if it's not available yet.
        uniqueid_from_vars: uniqueId || linkedId || details.id,
        // Prioritize CONNECTEDLINE(num), as it's more reliable for the external number.
        connected_line_num: connectedLineNum || details.caller?.number,
    };
}

export async function getAriEndpointDetails(connection: AriConnection, extension: string): Promise<any> {
    const response = await fetchFromAri(connection, `endpoints/PJSIP/${extension}`);
    if (!response.ok) {
        // This is not necessarily an error, endpoint might just not be in use
        return null;
    }
    return response.json();
}

/**
 * Tests the connection to ARI by fetching basic asterisk information.
 */
export async function testAriConnection(
  connection: AriConnection
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetchFromAri(connection, 'asterisk/info');
    if (response.ok) {
        const data = await response.json();
        const systemInfo = data.system_info;
        if (systemInfo && systemInfo.version) {
          return { success: true, data: { version: systemInfo.version } };
        }
        return { success: true, data: { version: 'Unknown (Connected)' } };
    }
    const errorBody = await response.text();
    const errorMessage = `Connection failed with status ${response.status}: ${errorBody}`;
    return { success: false, error: errorMessage };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}

/**
 * Determines if a user role is allowed to download recordings.
 */
export async function canDownloadRecording(role: UserRole | undefined): Promise<boolean> {
    if (!role) return false;
    return ['admin', 'supervisor', 'manager'].includes(role);
}
