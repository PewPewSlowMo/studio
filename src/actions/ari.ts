'use server';

import { z } from 'zod';

const AriConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.string().min(1, 'Port is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string(),
});

type AriConnection = z.infer<typeof AriConnectionSchema>;

async function fetchFromAri(connection: AriConnection, path: string) {
  const validatedConnection = AriConnectionSchema.parse(connection);
  const { host, port, username, password } = validatedConnection;
  const url = `http://${host}:${port}/ari/${path}`;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`ARI request failed with status ${response.status}: ${errorBody}`);
  }

  return response.json();
}


export async function testAriConnection(
  connection: AriConnection
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // A lightweight request to check the connection and authentication.
    const data = await fetchFromAri(connection, 'asterisk/info');
    return { success: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}
