'use server';

import crypto from 'crypto';
import { z } from 'zod';
import type { Appeal } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { getContacts } from './crm';
import { getDbConnection } from './app-db';

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

export async function saveAppeal(data: AppealFormData): Promise<{ success: boolean; appeal?: Appeal; error?: string }> {
  const db = await getDbConnection();
  try {
    const validatedData = AppealFormSchema.parse(data);

    const existingAppeal = await db.get<Appeal>('SELECT * FROM appeals WHERE callId = ?', validatedData.callId);

    let finalAppeal: Appeal;

    if (existingAppeal) {
        // Update existing appeal
        finalAppeal = {
            ...existingAppeal,
            ...validatedData,
            notes: validatedData.notes || '',
            followUpCompleted: validatedData.followUp === false ? false : existingAppeal.followUpCompleted,
        };
        await db.run(
            `UPDATE appeals SET 
                operatorId = ?, operatorName = ?, callerNumber = ?, description = ?, resolution = ?,
                category = ?, priority = ?, satisfaction = ?, notes = ?, followUp = ?, followUpCompleted = ?
             WHERE id = ?`,
            finalAppeal.operatorId, finalAppeal.operatorName, finalAppeal.callerNumber, finalAppeal.description,
            finalAppeal.resolution, finalAppeal.category, finalAppeal.priority, finalAppeal.satisfaction,
            finalAppeal.notes, finalAppeal.followUp, finalAppeal.followUpCompleted, finalAppeal.id
        );
    } else {
        // Create new appeal
        finalAppeal = {
            id: crypto.randomUUID(),
            ...validatedData,
            notes: validatedData.notes || '',
            createdAt: new Date().toISOString(),
            followUpCompleted: false, // Default for new appeals
        };
        await db.run(
            `INSERT INTO appeals (id, callId, operatorId, operatorName, callerNumber, description, resolution, category, priority, satisfaction, notes, followUp, followUpCompleted, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            finalAppeal.id, finalAppeal.callId, finalAppeal.operatorId, finalAppeal.operatorName, finalAppeal.callerNumber,
            finalAppeal.description, finalAppeal.resolution, finalAppeal.category, finalAppeal.priority, finalAppeal.satisfaction,
            finalAppeal.notes, finalAppeal.followUp, finalAppeal.followUpCompleted, finalAppeal.createdAt
        );
    }
    
    // Revalidate paths that consume this data
    revalidatePath('/operator');
    revalidatePath('/my-calls');
    
    return { success: true, appeal: finalAppeal };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error('saveAppeal failed:', message);
    return { success: false, error: message };
  } finally {
      await db.close();
  }
}

export async function getAppeals(): Promise<Appeal[]> {
    const db = await getDbConnection();
    try {
        const appeals = await db.all<Appeal[]>('SELECT * FROM appeals ORDER BY createdAt DESC');
        return appeals.map(a => ({...a, followUp: Boolean(a.followUp), followUpCompleted: Boolean(a.followUpCompleted)}));
    } finally {
        await db.close();
    }
}

export async function toggleFollowUpStatus(appealId: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDbConnection();
  try {
    const appeal = await db.get<Appeal>('SELECT * FROM appeals WHERE id = ?', appealId);
    if (!appeal) {
        return { success: false, error: 'Appeal not found.' };
    }
    const newStatus = !appeal.followUpCompleted;
    await db.run('UPDATE appeals SET followUpCompleted = ? WHERE id = ?', newStatus, appealId);
    revalidatePath('/operator');
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  } finally {
      await db.close();
  }
}

export async function getFollowUpAppeals(operatorId: string): Promise<(Appeal & { callerName?: string })[]> {
    const [appeals, crmData] = await Promise.all([
        getAppeals(),
        getContacts()
    ]);
    
    const crmMap = new Map(crmData.map(c => [c.phoneNumber, c.name]));

    const followUpAppeals = appeals
        .filter(appeal => 
            appeal.operatorId === operatorId &&
            appeal.followUp === true &&
            appeal.followUpCompleted === false
        )
        .map(appeal => ({
            ...appeal,
            callerName: crmMap.get(appeal.callerNumber)
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return followUpAppeals;
}
