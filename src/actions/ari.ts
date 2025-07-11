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

const RecordingNameSchema = z.string().regex(/^[a-zA-Z0-9\-_\.]+$/, {
    message: "Invalid recording name format."
});

/**
 * A robust fetch wrapper for making requests to the Asterisk REST Interface (ARI).
 * It handles connection errors, authentication, and logging.
 */
async function fetchFromAri(connection: AriConnection, path: string, options: RequestInit = {}) {
  const validatedConnection = AriConnectionSchema.parse(connection);
  const { host, port, username, password } = validatedConnection;
  const url = `http://${host}:${port}/ari/${path}`;
  
  console.log(`[ARI] Request to: ${url} with method ${options.method || 'GET'}`);

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
    return response;
  } catch (e) {
      if (e instanceof TypeError && e.message.includes('fetch failed')) {
        console.error(`[ARI FETCH ERROR] Cannot connect to ARI server at ${host}:${port}. Please check host, port, and network.`, e);
        // Return a synthetic error response that clearly indicates a connection failure.
        return new Response(JSON.stringify({ message: `Cannot connect to ARI server at ${host}:${port}` }), { status: 503, statusText: 'Service Unavailable' });
      }
      
      console.error(`[ARI FETCH ERROR] An unexpected network or fetch error occurred for ${url}:`, e);
      const message = e instanceof Error ? e.message : 'A network or fetch error occurred.';
      return new Response(JSON.stringify({ message }), { status: 500, statusText: 'Internal Server Error' });
  }
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
        return { success: true, data };
    }
    const errorBody = await response.text();
    const errorMessage = `Connection failed with status ${response.status}: ${errorBody}`;
    console.error(`[ARI TEST] ${errorMessage}`);
    return { success: false, error: errorMessage };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error(`[ARI TEST] Exception: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Determines if a user role is allowed to download recordings.
 */
export async function canDownloadRecording(role: UserRole | undefined): Promise<boolean> {
    if (!role) return false;
    // Define roles that can download recordings
    return ['admin', 'supervisor', 'manager'].includes(role);
}
