'use server';

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import type { Appeal } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const APPEALS_DB_PATH = path.join(process.cwd(), 'data', 'appeals.json');

const AppealFormSchema = z.object({
  callId: z.string(),
  operatorId: z.string(),
  operatorName: z.string(),
  callerNumber: z.string(),
  appealType: z.enum(['complaint', 'service', 'other']),
  description: z.string().min(1, 'Description is required'),
  resolution: z.string().optional(),
});

export type AppealFormData = z.infer<typeof AppealFormSchema>;

async function readAppeals(): Promise<Appeal[]> {
  try {
    await fs.mkdir(path.dirname(APPEALS_DB_PATH), { recursive: true });
    const data = await fs.readFile(APPEALS_DB_PATH, 'utf-8');
    return JSON.parse(data) as Appeal[];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(APPEALS_DB_PATH, JSON.stringify([]), 'utf-8');
      return [];
    }
    console.error('Error reading appeals database:', error);
    throw new Error('Could not read from the appeals database.');
  }
}

async function writeAppeals(appeals: Appeal[]): Promise<void> {
  await fs.writeFile(APPEALS_DB_PATH, JSON.stringify(appeals, null, 2), 'utf-8');
}

export async function saveAppeal(data: AppealFormData): Promise<{ success: boolean; appeal?: Appeal; error?: string }> {
  try {
    const validatedData = AppealFormSchema.parse(data);
    const appeals = await readAppeals();

    const newAppeal: Appeal = {
      id: crypto.randomUUID(),
      ...validatedData,
      resolution: validatedData.resolution || '',
      createdAt: new Date().toISOString(),
    };

    appeals.unshift(newAppeal); // Add to the beginning of the array
    await writeAppeals(appeals);
    
    // In the future, we might revalidate paths where appeals are shown, e.g. for supervisors.
    // revalidatePath('/supervisor/appeals');
    
    return { success: true, appeal: newAppeal };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error('saveAppeal failed:', message);
    return { success: false, error: message };
  }
}
