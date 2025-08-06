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

const AppDbSchema = z.object({
  path: z.string().min(1, 'Path is required'),
});

const ConfigSchema = z.object({
  ari: ConnectionSchema,
  ami: ConnectionSchema,
  cdr: DbConnectionSchema,
  app_db: AppDbSchema,
  queueMappings: z.record(z.string()).optional(),
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
  app_db: {
    path: 'data/app.db',
  },
  queueMappings: {},
};

export async function getConfig(): Promise<AppConfig> {
  try {
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsedData = JSON.parse(data);
    const mergedConfig = { 
        ...defaultConfig, 
        ...parsedData,
        queueMappings: {
            ...defaultConfig.queueMappings,
            ...(parsedData.queueMappings || {})
        }
    };
    return ConfigSchema.parse(mergedConfig);
  } catch (error) {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    return defaultConfig;
  }
}

export async function saveConfig(newConfig: Omit<AppConfig, 'app_db'> & { app_db: { path: string } }): Promise<{ success: boolean; error?: string }> {
  try {
    // We need to fetch the existing config to not overwrite fields that are not part of the form, like queueMappings
    const existingConfig = await getConfig();
    const fullConfig = { ...existingConfig, ...newConfig };

    const validatedConfig = ConfigSchema.parse(fullConfig);
    await fs.writeFile(CONFIG_PATH, JSON.stringify(validatedConfig, null, 2), 'utf-8');
    
    revalidatePath('/');
    revalidatePath('/reports');
    revalidatePath('/admin');
    revalidatePath('/queue-reports');

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error('Failed to save config:', message);
    return { success: false, error: message };
  }
}
