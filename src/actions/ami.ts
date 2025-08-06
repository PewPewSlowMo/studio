
'use server';

import { z } from 'zod';
import type { AsteriskEndpoint, AsteriskQueue } from '@/lib/types';
import { writeToLog } from './logger';

// This is a CommonJS module. We configure Next.js to treat it as an external
// package on the server via `serverComponentsExternalPackages` in next.config.ts.
const Ami = require('asterisk-manager');

const LOG_COMPONENT = 'AMI_ACTION';

const AmiConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.string().min(1, 'Port is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string(),
});

type AmiConnection = z.infer<typeof AmiConnectionSchema>;

async function withRetry<T>(fn: () => Promise<T>, retries = 1, delay = 100): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (retries > 0 && err.code === 'ECONNRESET') {
      await writeToLog(LOG_COMPONENT, `AMI connection reset. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(res => setTimeout(res, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw err;
  }
}

/**
 * Executes an AMI command and reliably collects all related events.
 * It sends an action and then waits for a short, fixed duration to gather all response events,
 * which is more reliable than waiting for a specific completion event that might arrive prematurely.
 */
function runAmiCommand<T extends Record<string, any>>(
  connection: AmiConnection,
  action: Record<string, string>,
  collectionTimeMs: number = 200 // Time in ms to wait for events after sending the action.
): Promise<T[]> {
  const commandFn = () => new Promise<T[]>((resolve, reject) => {
    let ami: any;
    const results: T[] = [];
    let isResolved = false;

    const timeout = setTimeout(() => {
        if (!isResolved) {
            isResolved = true;
            if (ami) ami.disconnect();
            writeToLog(LOG_COMPONENT, { level: 'ERROR', message: 'AMI command timed out after 20 seconds.', action });
            reject(new Error('AMI command timed out after 20 seconds.'));
        }
    }, 20000); // Overall safety timeout

    try {
      const validatedConnection = AmiConnectionSchema.parse(connection);
      writeToLog(LOG_COMPONENT, { level: 'INFO', message: `Executing AMI action`, action });

      ami = new Ami(
        Number(validatedConnection.port),
        validatedConnection.host,
        validatedConnection.username,
        validatedConnection.password,
        true // Enable events
      );
      
      ami.on('managerevent', (event: T) => {
        results.push(event); // Collect ALL events
      });
      
      ami.on('response', (response: T) => {
          // Some commands (like CoreSettings) send their data in the 'response' callback, not as separate events.
          // Let's add it to our results array.
          results.push(response);
      });
      
      ami.on('error', (err: Error) => {
          if (!isResolved) {
              isResolved = true;
              if (ami) ami.disconnect();
              writeToLog(LOG_COMPONENT, { level: 'ERROR', message: 'AMI connection error', error: err.message, action });
              reject(err);
          }
      });
      
      // Send the action, and if it fails immediately, reject.
      ami.action(action, (err: Error | null) => {
        if (err) {
          if (!isResolved) {
            isResolved = true;
            if (ami) ami.disconnect();
            writeToLog(LOG_COMPONENT, { level: 'ERROR', message: 'AMI action error', error: err.message, action });
            reject(err);
          }
        } else {
            // Action was sent successfully, now wait to collect events.
            setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    if (ami) ami.disconnect();
                    clearTimeout(timeout);
                    writeToLog(LOG_COMPONENT, { level: 'INFO', message: `AMI Action Complete. Total events received: ${results.length}`, action });
                    resolve(results);
                }
            }, collectionTimeMs);
        }
      });

    } catch (e) {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
        writeToLog(LOG_COMPONENT, { level: 'ERROR', message: `AMI command execution failed.`, error: errorMessage, action });

        if (e instanceof z.ZodError) {
            reject(new Error(`Invalid input: ${e.errors.map((err) => err.message).join(', ')}`));
        } else {
            reject(new Error(errorMessage));
        }
      }
    }
  });

  return withRetry(commandFn);
}


export async function testAmiConnection(
  connection: AmiConnection
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const action = { Action: 'CoreSettings' };
    const events = await runAmiCommand<any>(
      connection,
      action,
      200
    );
    // Find an event that has the Asterisk version. This might be in a 'response' or a managerevent.
    const eventWithVersion = events.find(e => e.asteriskversion);
    if (eventWithVersion) {
      return { success: true, data: { version: eventWithVersion.asteriskversion } };
    }
    // If for some reason that fails, it means we connected but couldn't get a version.
    return { success: true, data: { version: "Unknown (Connected)" } };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}

export async function getAmiEndpoint(
  connection: AmiConnection,
  endpointId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const action = { Action: 'PJSIPShowEndpoint', Endpoint: endpointId };
    const rawEvents = await runAmiCommand<any>(
      connection,
      action
    );

    // EndpointDetail contains high-level info.
    const detailEvent = rawEvents.find(e => e.event === 'EndpointDetail');
    if (!detailEvent) {
      return { success: false, error: `Endpoint ${endpointId} not found.` };
    }
    
    // AorDetail provides channel IDs and call info
    const aorDetails = rawEvents.filter(e => e.event === 'AorDetail');
    
    // ChanVariable provides connected line info during a call
    const chanVariables = rawEvents.filter(e => e.event === 'ChanVariable');
    const connectedLineNumVar = chanVariables.find(v => v.variable === 'CONNECTEDLINE(num)');
    
    const contactStatus = rawEvents.find(e => e.event === 'ContactStatusDetail');

    // Combine all relevant event data into a single object
    const combinedData: Record<string, any> = { ...detailEvent };

    if (aorDetails.length > 0) {
        // Find the most relevant AOR, e.g., the one with a channel
        const primaryAor = aorDetails.find(a => a.channel) || aorDetails[0];
        Object.assign(combinedData, primaryAor);
    }
    
    if (contactStatus) {
        Object.assign(combinedData, contactStatus);
    }

    if (connectedLineNumVar) {
        combinedData.connectedlinenum = connectedLineNumVar.value;
    }

    return { success: true, data: combinedData };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error(`Error in getAmiEndpoint for ${endpointId}:`, message);
    return { success: false, error: message };
  }
}

export async function getAmiEndpoints(
  connection: AmiConnection
): Promise<{ success: boolean; data?: AsteriskEndpoint[]; error?: string }> {
  try {
    const action = { Action: 'PJSIPShowEndpoints' };
    const rawEvents = await runAmiCommand<any>(
      connection,
      action
    );
    
    const rawEndpoints = rawEvents.filter(e => e.event === 'EndpointList');
    const contactStatuses = rawEvents.filter(e => e.event === 'ContactStatusDetail');
    const contactStatusMap = new Map(contactStatuses.map(cs => [cs.aor, cs]));

    const data = rawEndpoints.map((e) => {
      const contactStatus = contactStatusMap.get(e.objectname);
      // Prefer the more specific ContactStatus, fallback to the general DeviceState
      const state = contactStatus?.status || e.devicestate;

      return {
        technology: 'PJSIP',
        resource: e.objectname,
        state: state?.toLowerCase() || 'unknown',
        channel_ids: e.channel ? [e.channel] : [],
      };
    });

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
      500 // Queues can sometimes take a bit longer to report all members.
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

    