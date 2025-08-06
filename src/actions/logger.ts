'use server';

import fs from 'fs/promises';
import path from 'path';
import { format } from 'date-fns';

const LOG_FILE = path.join(process.cwd(), 'data', 'app_debug.log');

// Ensure the data directory exists
const ensureDataDir = async () => {
  try {
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  } catch (error) {
    console.error('Failed to create data directory for logs:', error);
  }
};

// Call it once when the module is loaded
ensureDataDir();

/**
 * Appends a message to the debug log file.
 * Adds a timestamp and a newline character to each message.
 * @param component - The name of the component or module logging the message.
 * @param message - The message to log. Can be a string or an object.
 */
export async function writeToLog(component: string, message: string | object) {
  try {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS');
    
    let logMessage: string;
    if (typeof message === 'object') {
        // Pretty print JSON for better readability in the log
        logMessage = JSON.stringify(message, null, 2);
    } else {
        logMessage = message;
    }

    const formattedMessage = `[${timestamp}] [${component}]\n${logMessage}\n\n`;

    await fs.appendFile(LOG_FILE, formattedMessage, 'utf-8');
  } catch (error) {
    // If logging fails, log to the console as a fallback.
    console.error(`[LOGGER] Failed to write to log file:`, error);
    console.error(`[LOGGER] Original message from ${component}:`, message);
  }
}
