'use server';

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'config.json');

const ConnectionSchema = z.object({
  host: z.string(),
  port: z.string(),
  username: z.string(),
  password: z.string(),
});

const DbConnectionSchema = ConnectionSchema.extend({
  database: z.string(),
});

const ConfigSchema = z.object({
  ari: ConnectionSchema,
  ami: ConnectionSchema,
  cdr: DbConnectionSchema,
});

export type AppConfig = z.infer<typeof ConfigSchema>;

const defaultConfig: AppConfig = {
  ari: {
    host: '92.46.62.34',
    port: '8088',
    username: 'smart-call-center',
    password: 'Almaty20252025',
  },
  ami: {
    host: '92.46.62.34',
    port: '5038',
    username: 'smart_call_cent',
    password: 'Almaty20252025',
  },
  cdr: {
    host: '92.46.62.34',
    port: '3306',
    username: 'smartcallcenter',
    password: 'StrongPassword123!',
    database: 'asteriskcdrdb',
  },
};

export async function getConfig(): Promise<AppConfig> {
  try {
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    // Ensure data is parsed and then validated.
    const parsedData = JSON.parse(data);
    // Merge with defaults to ensure all keys are present
    const mergedConfig = { ...defaultConfig, ...parsedData };
    return ConfigSchema.parse(mergedConfig);
  } catch (error) {
    // If file doesn't exist or is invalid, write the default and return it
    await fs.writeFile(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    return defaultConfig;
  }
}

export async function saveConfig(newConfig: Omit<AppConfig, 'app_db'>): Promise<{ success: boolean; error?: string }> {
  try {
    const validatedConfig = ConfigSchema.parse(newConfig);
    await fs.writeFile(CONFIG_PATH, JSON.stringify(validatedConfig, null, 2), 'utf-8');
    // Revalidate paths that use this config
    revalidatePath('/');
    revalidatePath('/reports');
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error('Failed to save config:', message);
    return { success: false, error: message };
  }
}
