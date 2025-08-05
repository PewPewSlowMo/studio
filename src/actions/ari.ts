'use server';

import { z } from 'zod';
import type { UserRole, CallState } from '@/lib/types';

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
        console.error(`[ARI FETCH ERROR] Cannot connect to ARI server at ${host}:${port}.`);
        return new Response(JSON.stringify({ message: `Cannot connect to ARI server at ${host}:${port}` }), { status: 503, statusText: 'Service Unavailable' });
      }
      console.error(`[ARI FETCH ERROR] An unexpected network or fetch error occurred for ${url}:`, e);
      const message = e instanceof Error ? e.message : 'A network or fetch error occurred.';
      return new Response(JSON.stringify({ message }), { status: 500, statusText: 'Internal Server Error' });
  }
}

export async function getAriChannelDetails(connection: AriConnection, channelId: string): Promise<any> {
    const response = await fetchFromAri(connection, `channels/${channelId}`);
    if (!response.ok) {
        throw new Error(`Failed to get channel details for ${channelId}: ${response.statusText}`);
    }
    return response.json();
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
    return ['admin', 'supervisor', 'manager'].includes(role);
}
