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
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
    },
    credentials: 'include', 
    cache: 'no-store',
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  if (!response.ok) {
    if (response.status === 404 && options?.method === 'HEAD') {
        return { ok: false, status: 404, error: 'Recording not found' };
    }
    const errorBody = await response.text();
    console.error(`ARI Error: ${response.status} on ${path}. Body: ${errorBody}`);
    throw new Error(`ARI request failed with status ${response.status}: ${errorBody}`);
  }
  
  if (options?.method === 'HEAD') {
    return { ok: true, status: response.status };
  }

  return response;
}


export async function testAriConnection(
  connection: AriConnection
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetchFromAri(connection, 'asterisk/info');
    const data = await (response as Response).json();
    return { success: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}

export async function checkRecordingExists(connection: AriConnection, recordingName: string): Promise<{ success: boolean, exists: boolean, error?: string }> {
  try {
    const response = await fetchFromAri(connection, `recordings/stored/${recordingName}`, { method: 'HEAD' });
    return { success: true, exists: response.ok };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error(`Error checking recording for ${recordingName}:`, message);
    return { success: false, exists: false, error: message };
  }
}

export async function getRecording(connection: AriConnection, recordingName: string): Promise<{ success: boolean, dataUri?: string, error?: string }> {
    try {
        const response = await fetchFromAri(connection, `recordings/stored/${recordingName}/file`);
        if (!(response as Response).ok) {
            const errorText = await (response as Response).text();
            return { success: false, error: `Recording not found or error fetching: ${errorText}` };
        }
        
        const audioBuffer = await (response as Response).arrayBuffer();
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
