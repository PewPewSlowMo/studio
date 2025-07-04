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

function runAmiCommand<T extends Record<string, any>>(
  connection: AmiConnection,
  action: Record<string, string>,
  completionEvent: string
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    let ami: any;
    const timeout = setTimeout(() => {
        if (ami) ami.disconnect();
        reject(new Error('AMI command timed out after 10 seconds.'));
    }, 10000); 

    try {
      const validatedConnection = AmiConnectionSchema.parse(connection);

      ami = new Ami(
        Number(validatedConnection.port),
        validatedConnection.host,
        validatedConnection.username,
        validatedConnection.password,
        true // Enable events
      );

      const results: T[] = [];

      ami.on('disconnect', () => {
        clearTimeout(timeout);
      });

      ami.on('managerevent', (event: T) => {
        if (event.event === completionEvent) {
          ami.disconnect();
          resolve(results);
        } else {
          results.push(event);
        }
      });
      
      ami.on('error', (err: Error) => {
          ami.disconnect();
          reject(err);
      });

      ami.action(action, (err: Error | null) => {
        if (err) {
          ami.disconnect();
          reject(err);
        }
      });

    } catch (e) {
      clearTimeout(timeout);
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

function runAmiAction(
  connection: AmiConnection,
  action: Record<string, string>
): Promise<{ success: boolean; message?: string; data?: any }> {
  return new Promise(async (resolve, reject) => {
    let ami: any;
    const timeout = setTimeout(() => {
      if (ami) ami.disconnect();
      const timeoutError = new Error('AMI action timed out after 10 seconds.');
      reject(timeoutError);
    }, 10000);

    try {
      const validatedConnection = AmiConnectionSchema.parse(connection);
      ami = new Ami(
        Number(validatedConnection.port),
        validatedConnection.host,
        validatedConnection.username,
        validatedConnection.password,
        true
      );
      
      const actionid = new Date().getTime().toString();
      action.actionid = actionid;

      ami.on('disconnect', () => {
        clearTimeout(timeout);
      });

      ami.on('error', (err: Error) => {
        if(ami) ami.disconnect();
        reject(err);
      });
      
      ami.action(action, (err: any, res: any) => {
        if(ami) ami.disconnect();
        if (err) {
            if (typeof err === 'object' && err !== null && err.message) {
                reject(new Error(err.message));
            } else {
                reject(err);
            }
            return;
        }
        if (res?.response === 'Success') {
          resolve({ success: true, message: res.message || 'Action was successful.', data: res });
        } else {
          reject(new Error(res?.message || 'Action failed: Asterisk did not return "Success".'));
        }
      });

    } catch (e) {
      clearTimeout(timeout);
      if (ami) ami.disconnect();
      
      let errorMessage = 'An unknown error occurred during AMI action execution.';
      if (e instanceof z.ZodError) {
        errorMessage = `Invalid input: ${e.errors.map((err) => err.message).join(', ')}`;
      } else if (e instanceof Error) {
        errorMessage = e.message;
      }
      
      reject(new Error(errorMessage));
    }
  });
}

export async function answerCallAmi(
  connection: AmiConnection,
  channel: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const action = {
      Action: 'Command',
      Command: `channel answer ${channel}`,
    };
    await runAmiAction(connection, action);
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}

export async function hangupCallAmi(
  connection: AmiConnection,
  channel: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const action = {
      Action: 'Hangup',
      Channel: channel,
    };
    await runAmiAction(connection, action);
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}

export async function originateCall(
  connection: AmiConnection,
  fromExtension: string,
  numberToDial: string,
  context: string = 'from-internal'
): Promise<{ success: boolean; error?: string }> {
  try {
    const action = {
      Action: 'Originate',
      Channel: `PJSIP/${fromExtension}`,
      Context: context,
      Exten: numberToDial,
      Priority: 1,
      CallerID: `"${fromExtension}" <${fromExtension}>`,
      Async: 'true',
      Timeout: 20000, // 20 seconds
    };
    const result = await runAmiAction(connection, action);
    if (result.success) {
      return { success: true };
    }
    return { success: false, error: result.message || 'Origination failed' };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}

export async function getEndpointDetails(
  connection: AmiConnection,
  extension: string
): Promise<{ success: boolean; data?: AsteriskEndpoint; error?: string }> {
    const result = await getAmiEndpoints(connection);
    if (!result.success) {
        return { success: false, error: result.error };
    }
    const endpoint = result.data?.find(e => e.resource === extension);
    if (endpoint) {
        return { success: true, data: endpoint };
    }
    return { success: false, error: `Endpoint ${extension} not found.` };
}

export async function getAmiEndpoints(
  connection: AmiConnection
): Promise<{ success: boolean; data?: AsteriskEndpoint[]; error?: string }> {
  try {
    const action = { Action: 'PJSIPShowEndpoints' };
    const rawEvents = await runAmiCommand<any>(
      connection,
      action,
      'EndpointListComplete'
    );
    
    const rawEndpoints = rawEvents.filter(e => e.event === 'EndpointList');

    const data = rawEndpoints.map((e) => ({
      technology: 'PJSIP',
      resource: e.objectname,
      state: e.devicestate?.toLowerCase() || 'unknown',
      channel_ids: e.channel ? [e.channel] : [],
    }));

    return { success: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}

export async function getAmiQueues(
  connection: AmiConnection
): Promise<{ success: boolean; data?: AsteriskQueue[]; error?: string }> {
  try {
    const action = { Action: 'QueueStatus' };
    const rawEvents = await runAmiCommand<any>(
      connection,
      action,
      'QueueStatusComplete'
    );

    const rawQueues = rawEvents.filter(q => q.event === 'QueueParams');

    const data = rawQueues.map((q) => ({
      name: q.queue,
    }));
    
    const uniqueQueues = [...new Map(data.map((item) => [item.name, item])).values()];

    return { success: true, data: uniqueQueues };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}
