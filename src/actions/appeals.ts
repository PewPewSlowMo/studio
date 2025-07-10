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
  resolution: z.enum(['переведен старшему оператору', 'услуга оказана полностью', 'услуга оказана частично', 'отказано в услуге']),
  category: z.enum(['Жалобы', 'Прикрепление', 'Запись на прием', 'Информация', 'Госпитализация', 'Анализы', 'Иные']),
  priority: z.enum(['low', 'medium', 'high']),
  satisfaction: z.enum(['yes', 'no']),
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

    const existingAppealIndex = appeals.findIndex(a => a.callId === validatedData.callId);

    let finalAppeal: Appeal;

    if (existingAppealIndex > -1) {
      // Update existing appeal
      const existingAppeal = appeals[existingAppealIndex];
      finalAppeal = {
        ...existingAppeal, // Preserve id, createdAt, etc.
        ...validatedData,   // Apply new data from the form
        notes: validatedData.notes || '',
      };
      // Explicitly check if `followUp` is false to reset completed status
      if (validatedData.followUp === false) {
          finalAppeal.followUpCompleted = false;
      }

      appeals[existingAppealIndex] = finalAppeal;
    } else {
      // Create new appeal
      finalAppeal = {
        id: crypto.randomUUID(),
        ...validatedData,
        notes: validatedData.notes || '',
        createdAt: new Date().toISOString(),
        followUpCompleted: false, // Default for new appeals
      };
      appeals.unshift(finalAppeal);
    }
    
    await writeAppeals(appeals);
    
    // Revalidate paths that consume this data
    revalidatePath('/operator');
    revalidatePath('/my-calls');
    
    return { success: true, appeal: finalAppeal };
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
    
    // Ensure the property exists before toggling
    const currentStatus = appeals[appealIndex].followUpCompleted || false;
    appeals[appealIndex].followUpCompleted = !currentStatus;

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
            appeal.followUp === true &&         // Follow-up is explicitly required
            appeal.followUpCompleted === false  // And it's explicitly not completed yet
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
