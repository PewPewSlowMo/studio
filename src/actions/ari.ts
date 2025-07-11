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
  
  // Correctly create Basic auth header for Node.js environment
  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const defaultOptions: RequestInit = {
    headers: {
      'Authorization': `Basic ${auth}`,
    },
    cache: 'no-store',
  };

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    // Not OK responses are handled by the caller, just return the response object
    return { ok: response.ok, status: response.status, response };
  } catch (e) {
      const message = e instanceof Error ? e.message : 'A network or fetch error occurred.';
      console.error(`[ARI FETCH ERROR] Failed to fetch ${url}:`, e);
      // Return a synthetic error response
      return { ok: false, status: 500, response: new Response(JSON.stringify({ message }), { status: 500 }) };
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
    const errorMessage = `Connection failed with status ${status}: ${errorBody}`;
    console.error(`[ARI TEST] ${errorMessage}`);
    return { success: false, error: errorMessage };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error(`[ARI TEST] Exception: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Checks if a recording exists. ARI does not support HEAD, so we use GET and check the status.
 * This is more reliable across different Asterisk versions.
 */
export async function checkRecordingExists(connection: AriConnection, recordingName: string): Promise<{ success: boolean, exists: boolean, error?: string }> {
  const fullPath = `recordings/stored/${recordingName}`;
  try {
    const { ok, status, response } = await fetchFromAri(connection, fullPath);

    if (ok) {
        return { success: true, exists: true };
    }
    if (status === 404) {
        return { success: true, exists: false };
    }
    // Any other error code is a failure.
    const errorBody = await response?.text();
    const errorMessage = `ARI request failed with status ${status}: ${errorBody}`;
    console.error(`[ARI CHECK] Error checking recording at ${fullPath}:`, errorMessage);
    return { success: false, exists: false, error: errorMessage };

  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error(`[ARI CHECK] Exception while checking ${fullPath}:`, message);
    return { success: false, exists: false, error: message };
  }
}


/**
 * Gets the actual audio file of a stored recording.
 */
export async function getRecording(connection: AriConnection, recordingName: string): Promise<{ success: boolean, dataUri?: string, error?: string }> {
    const fullPath = `recordings/stored/${recordingName}/file`;
    try {
        const { ok, response, status } = await fetchFromAri(connection, fullPath);
        
        if (!ok || !response) {
            const errorBody = await response?.text();
            const errorMessage = `Recording not found or error fetching with status ${status}: ${errorBody}`;
            console.error(`[ARI GET] Failed to get recording at ${fullPath}:`, errorMessage);
            return { success: false, error: errorMessage };
        }
        
        const audioBuffer = await response.arrayBuffer();
        const base64Data = Buffer.from(audioBuffer).toString('base64');
        const dataUri = `data:audio/wav;base64,${base64Data}`;

        return { success: true, dataUri };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error(`[ARI GET] Exception while getting ${fullPath}:`, message);
    return { success: false, error: message };
  }
}


export async function canDownloadRecording(role: UserRole | undefined): Promise<boolean> {
    if (!role) return false;
    return ['admin', 'supervisor', 'manager'].includes(role);
}
