'use server';

import { z } from 'zod';
import type { AsteriskEndpoint, AsteriskQueue } from '@/lib/types';

// This is a CommonJS module. We configure Next.js to treat it as an external
// package on the server via `serverComponentsExternalPackages` in next.config.ts.
const Ami = require('asterisk-manager');

const AmiConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.string().min(1, 'Port is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string(),
});

type AmiConnection = z.infer<typeof AmiConnectionSchema>;

function runAmiCommand<T>(
  connection: AmiConnection,
  action: object,
  responseEvents: string[],
  completionEvent: string
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    try {
      const validatedConnection = AmiConnectionSchema.parse(connection);
      const { host, port, username, password } = validatedConnection;

      const ami = new Ami(parseInt(port, 10), host, username, password, true);
      let results: T[] = [];
      let isDone = false;

      const cleanup = () => {
        if (!isDone) {
          isDone = true;
          try {
            ami.disconnect();
          } catch (e) {
            // ignore errors on disconnect
          }
        }
      };

      ami.on('error', (err: Error) => {
        if (!isDone) {
          cleanup();
          reject(new Error(`AMI connection error: ${err.message}`));
        }
      });
      
      ami.on('disconnect', () => {
        if (!isDone) {
           cleanup();
           reject(new Error('AMI disconnected unexpectedly.'));
        }
      });

      ami.on('connect', () => {
        ami.action(action, (err: Error | null, res: { response: string; message: string; }) => {
          if (err) {
            cleanup();
            reject(new Error(`AMI action execution error: ${err.message}`));
          } else if (res?.response === 'Error') {
            cleanup();
            reject(new Error(`AMI action failed: ${res.message}`));
          }
        });
      });

      ami.on('managerevent', (evt: any) => {
        if (responseEvents.includes(evt.event)) {
          results.push(evt as T);
        }

        if (evt.event === completionEvent) {
          cleanup();
          resolve(results);
        }
      });

      // Timeout
      setTimeout(() => {
        if (!isDone) {
          cleanup();
          reject(new Error('AMI command timed out after 10 seconds.'));
        }
      }, 10000);

      ami.keepConnected();
    } catch (e) {
      if (e instanceof z.ZodError) {
        reject(new Error(`Invalid input: ${e.errors.map((err) => err.message).join(', ')}`));
      } else if (e instanceof Error) {
        reject(e);
      } else {
        reject(new Error('An unknown error occurred during AMI command execution.'));
      }
    }
  });
}

export async function getAmiEndpoints(
  connection: AmiConnection
): Promise<{ success: boolean; data?: AsteriskEndpoint[]; error?: string }> {
  try {
    const action = { action: 'PJSIPShowEndpoints' };
    const rawEndpoints = await runAmiCommand<any>(
      connection,
      action,
      ['EndpointList'],
      'EndpointListComplete'
    );

    const data = rawEndpoints.map((e) => ({
      technology: 'PJSIP',
      resource: e.objectname,
      state: e.devicestate.toLowerCase(),
      channel_ids: e.channel ? [e.channel] : [],
    }));

    return { success: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error('getAmiEndpoints failed:', message);
    return { success: false, error: message };
  }
}

export async function getAmiQueues(
  connection: AmiConnection
): Promise<{ success: boolean; data?: AsteriskQueue[]; error?: string }> {
  try {
    const action = { action: 'QueueStatus' };
    const rawQueues = await runAmiCommand<any>(
      connection,
      action,
      ['QueueParams'],
      'QueueStatusComplete'
    );

    const data = rawQueues.map((q) => ({
      name: q.queue,
    }));
    
    const uniqueQueues = [...new Map(data.map((item) => [item.name, item])).values()];

    return { success: true, data: uniqueQueues };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error('getAmiQueues failed:', message);
    return { success: false, error: message };
  }
}
