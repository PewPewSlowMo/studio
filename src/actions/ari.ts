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
 * Efficiently checks if a stored recording exists using a HEAD request.
 * If HEAD fails with 405 (Method Not Allowed), it falls back to a GET request without downloading the body.
 */
export async function checkRecordingExists(connection: AriConnection, recordingName: string): Promise<{ success: boolean; exists: boolean; error?: string }> {
  try {
    RecordingNameSchema.parse(recordingName);
  } catch(e) {
    return { success: false, exists: false, error: (e as z.ZodError).errors[0].message };
  }

  const fullPath = `recordings/stored/${recordingName}`;
  
  // First, try a HEAD request for maximum efficiency.
  let response = await fetchFromAri(connection, fullPath, { method: 'HEAD' });

  // Fallback to GET if HEAD is not allowed, as some ARI versions might not support it.
  if (response.status === 405) {
      console.warn(`[ARI CHECK] HEAD method not allowed for ${fullPath}. Falling back to GET.`);
      response = await fetchFromAri(connection, fullPath, { method: 'GET' });
  }

  if (response.ok) {
      return { success: true, exists: true };
  }
  if (response.status === 404) {
      return { success: true, exists: false };
  }
  
  // Any other status is an error.
  const errorBody = await response.text();
  const errorMessage = `ARI check failed with status ${response.status}: ${errorBody}`;
  console.error(`[ARI CHECK] Error checking recording at ${fullPath}:`, errorMessage);
  return { success: false, exists: false, error: errorMessage };
}


/**
 * Gets the actual audio file of a stored recording.
 * It correctly determines the content type from the response headers.
 */
export async function getRecording(connection: AriConnection, recordingName: string): Promise<{ success: boolean, dataUri?: string, error?: string }> {
    try {
      RecordingNameSchema.parse(recordingName);
    } catch(e) {
      return { success: false, error: (e as z.ZodError).errors[0].message };
    }

    const fullPath = `recordings/stored/${recordingName}/file`;
    const response = await fetchFromAri(connection, fullPath);
        
    if (!response.ok) {
        const errorBody = await response.text();
        const errorMessage = `Recording not found or error fetching with status ${response.status}: ${errorBody}`;
        console.error(`[ARI GET] Failed to get recording at ${fullPath}:`, errorMessage);
        return { success: false, error: errorMessage };
    }
    
    // Determine content type from headers, default to audio/wav if not present.
    const contentType = response.headers.get('Content-Type') || 'audio/wav';
    console.log(`[ARI GET] Got recording with Content-Type: ${contentType}`);

    const audioBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(audioBuffer).toString('base64');
    const dataUri = `data:${contentType};base64,${base64Data}`;

    return { success: true, dataUri };
}


/**
 * Determines if a user role is allowed to download recordings.
 */
export async function canDownloadRecording(role: UserRole | undefined): Promise<boolean> {
    if (!role) return false;
    // Define roles that can download recordings
    return ['admin', 'supervisor', 'manager'].includes(role);
}
