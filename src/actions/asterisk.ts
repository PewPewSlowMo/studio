'use server';

import { z } from 'zod';

const AsteriskInfoSchema = z.object({
  build: z.object({
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

export async function getAsteriskVersion(
  connection: AsteriskConnection
): Promise<{ success: boolean; version?: string; error?: string }> {
  try {
    const validatedConnection = AsteriskConnectionSchema.parse(connection);
    const { host, port, username, password } = validatedConnection;

    const url = `http://${host}:${port}/ari/asterisk/info`;
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
        error: `Connection failed with status: ${response.status} ${response.statusText}. ${errorDetails}`,
      };
    }

    const data = await response.json();
    const parsedData = AsteriskInfoSchema.safeParse(data);

    if (!parsedData.success) {
      return {
        success: false,
        error: `Successfully connected, but the response format was unexpected.`,
      };
    }

    return { success: true, version: parsedData.data.build.version };
  } catch (e) {
    if (e instanceof z.ZodError) {
        return { success: false, error: `Invalid input: ${e.errors.map(err => err.message).join(', ')}` };
    }
    if (e instanceof Error) {
        // Handle network errors etc.
        if (e.message.includes('fetch failed')) {
            return { success: false, error: 'Network error: Could not reach the host. Check the host, port, and network connectivity.' };
        }
        return { success: false, error: e.message };
    }
    return { success: false, error: 'An unknown error occurred.' };
  }
}
