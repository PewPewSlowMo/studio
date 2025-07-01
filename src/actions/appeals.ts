'use server';

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import type { Appeal } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { getContacts } from './crm';

const APPEALS_DB_PATH = path.join(process.cwd(), 'data', 'appeals.json');

const AppealFormSchema = z.object({
  callId: z.string(),
  operatorId: z.string(),
  operatorName: z.string(),
  callerNumber: z.string(),
  description: z.string().min(1, 'Description is required'),
  resolution: z.string().optional(),
  category: z.enum(['sales', 'complaint', 'support', 'info', 'other']),
  priority: z.enum(['low', 'medium', 'high']),
  satisfaction: z.enum(['satisfied', 'neutral', 'dissatisfied', 'n/a']),
  notes: z.string().optional(),
  followUp: z.boolean().default(false),
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
      notes: validatedData.notes || '',
      createdAt: new Date().toISOString(),
      followUpCompleted: false,
    };

    appeals.unshift(newAppeal);
    await writeAppeals(appeals);
    
    revalidatePath('/operator');
    return { success: true, appeal: newAppeal };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error('saveAppeal failed:', message);
    return { success: false, error: message };
  }
}

export async function getAppeals(): Promise<Appeal[]> {
    return readAppeals();
}

export async function toggleFollowUpStatus(appealId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const appeals = await readAppeals();
    const appealIndex = appeals.findIndex(a => a.id === appealId);

    if (appealIndex === -1) {
      return { success: false, error: 'Appeal not found.' };
    }

    appeals[appealIndex].followUpCompleted = !appeals[appealIndex].followUpCompleted;
    await writeAppeals(appeals);

    revalidatePath('/operator');
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}

export async function getFollowUpAppeals(operatorId: string): Promise<(Appeal & { callerName?: string })[]> {
    const [appeals, crmData] = await Promise.all([
        readAppeals(),
        getContacts()
    ]);
    
    const crmMap = new Map(crmData.map(c => [c.phoneNumber, c.name]));

    const followUpAppeals = appeals
        .filter(appeal => 
            appeal.operatorId === operatorId && // Belongs to this operator
            appeal.followUp &&                  // Follow-up is required
            !appeal.followUpCompleted           // And it's not completed yet
        )
        .map(appeal => ({
            ...appeal,
            callerName: crmMap.get(appeal.callerNumber)
        }))
        .sort((a, b) => {
            // Sort by creation date, newest first
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

    return followUpAppeals;
}
