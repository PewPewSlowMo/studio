'use server';

import { z } from 'zod';
import type { AsteriskEndpoint, AsteriskQueue } from '@/lib/types';

const AsteriskInfoSchema = z.object({
  system: z.object({
    version: z.string(),
  }),
});

const AsteriskEndpointSchema = z.array(
  z.object({
    technology: z.string(),
    resource: z.string(),
    state: z.string(),
    channel_ids: z.array(z.string()),
  })
);

const AsteriskQueueSchema = z.array(
  z.object({
    name: z.string(),
    callers: z.array(z.any()),
    members: z.array(z.any()),
  })
);


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

export async function getAsteriskEndpoints(
  connection: AsteriskConnection
): Promise<{ success: boolean; data?: AsteriskEndpoint[]; error?: string }> {
  return fetchFromAri(connection, 'endpoints', AsteriskEndpointSchema);
}

export async function getAsteriskQueues(
  connection: AsteriskConnection
): Promise<{ success: boolean; data?: AsteriskQueue[]; error?: string }> {
  return fetchFromAri(connection, 'queues', AsteriskQueueSchema);
}
