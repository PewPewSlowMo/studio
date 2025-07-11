'use server';

import { z } from 'zod';
import type { UserRole } from '@/lib/types';

const AriConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.string().min(1, 'Port is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string(),
});

type AriConnection = z.infer<typeof AriConnectionSchema>;

async function fetchFromAri(connection: AriConnection, path: string, options?: RequestInit) {
  const validatedConnection = AriConnectionSchema.parse(connection);
  const { host, port, username, password } = validatedConnection;
  const url = `http://${host}:${port}/ari/${path}`;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const defaultOptions: RequestInit = {
    headers: {
      'Authorization': `Basic ${auth}`,
    },
    // IMPORTANT: This allows sending credentials over http, which is necessary for local dev setups.
    // In a production environment with HTTPS, this would still be secure.
    credentials: 'include', 
    cache: 'no-store',
  };

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    return { ok: response.ok, status: response.status, response };
  } catch (e) {
      const message = e instanceof Error ? e.message : 'A network or fetch error occurred.';
      console.error(`Fetch Error on ${path}:`, e);
      // Return a 500 status for network-level errors
      return { ok: false, status: 500, response: new Response(message, { status: 500 }) };
  }
}

export async function testAriConnection(
  connection: AriConnection
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { ok, response, status } = await fetchFromAri(connection, 'asterisk/info');
    if (ok && response) {
        const data = await response.json();
        return { success: true, data };
    }
    const errorBody = await response?.text();
    return { success: false, error: `Connection failed with status ${status}: ${errorBody}` };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}

/**
 * Checks if a recording exists using a GET request and checking the status.
 * ARI does not support HEAD for this endpoint.
 */
export async function checkRecordingExists(connection: AriConnection, recordingName: string): Promise<{ success: boolean, exists: boolean, error?: string }> {
  try {
    // We use GET because HEAD is not allowed (405 error). We won't read the body.
    const { ok, status, response } = await fetchFromAri(connection, `recordings/stored/${recordingName}`);

    if (ok) {
        return { success: true, exists: true };
    }
    if (status === 404) {
        return { success: true, exists: false };
    }
    // Any other error code is a failure.
    const errorBody = await response?.text();
    const errorMessage = `ARI request failed with status ${status}: ${errorBody}`;
    console.error(`Error in checkRecordingExists for ${recordingName}:`, errorMessage);
    return { success: false, exists: false, error: errorMessage };

  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error(`Error checking recording for ${recordingName}:`, message);
    return { success: false, exists: false, error: message };
  }
}


/**
 * Gets the actual audio file of a stored recording.
 */
export async function getRecording(connection: AriConnection, recordingName: string): Promise<{ success: boolean, dataUri?: string, error?: string }> {
    try {
        // IMPORTANT: The path must end with /file to get the audio data
        const { ok, response, status } = await fetchFromAri(connection, `recordings/stored/${recordingName}/file`);
        
        if (!ok || !response) {
            const errorBody = await response?.text();
            return { success: false, error: `Recording not found or error fetching with status ${status}: ${errorBody}` };
        }
        
        const audioBuffer = await response.arrayBuffer();
        const base64Data = Buffer.from(audioBuffer).toString('base64');
        const dataUri = `data:audio/wav;base64,${base64Data}`;

        return { success: true, dataUri };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error(`Error getting recording for ${recordingName}:`, message);
    return { success: false, error: message };
  }
}


export async function canDownloadRecording(role: UserRole | undefined): Promise<boolean> {
    if (!role) return false;
    return ['admin', 'supervisor', 'manager'].includes(role);
}
