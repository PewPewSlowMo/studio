'use server';

import { z } from 'zod';
import type { Call, CrmContact } from '@/lib/types';
import { getConfig } from './config';
import { getCallHistory } from './cdr';
import { getUsers } from './users';
import { getDbConnection } from './app-db';

const CrmContactSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  type: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  notes: z.string().optional(),
});

export async function findContactByPhone(phoneNumber: string): Promise<{ contact: CrmContact | null, history: Call[] }> {
    if (!phoneNumber || phoneNumber === 'anonymous') {
        return { contact: null, history: [] };
    }
    
    const db = await getDbConnection();
    try {
      const contact = await db.get<CrmContact>('SELECT * FROM crm_contacts WHERE phoneNumber = ?', phoneNumber);
      
      const [config, users] = await Promise.all([
          getConfig(),
          getUsers(),
      ]);

      const callHistoryResult = await getCallHistory(config.cdr); // Fetches last 24h by default
      
      let history: Call[] = [];
      if (callHistoryResult.success && callHistoryResult.data) {
          const userMap = new Map(users.filter(u => u.extension).map(user => [user.extension, user.name]));
          history = callHistoryResult.data
              .filter(call => call.callerNumber === phoneNumber)
              .map(call => ({
                  ...call,
                  operatorName: call.operatorExtension 
                      ? (userMap.get(call.operatorExtension) || `Ext. ${call.operatorExtension}`) 
                      : 'N/A',
              }))
              .slice(0, 5); // Limit to last 5 calls for the popup
      }

      return { contact: contact || null, history };
    } finally {
      await db.close();
    }
}

export async function addOrUpdateContact(contactData: CrmContact): Promise<{ success: boolean; error?: string }> {
  const db = await getDbConnection();
  try {
    const validatedData = CrmContactSchema.parse(contactData);

    await db.run(
      `INSERT INTO crm_contacts (phoneNumber, name, address, type, email, notes)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(phoneNumber) DO UPDATE SET
         name = excluded.name,
         address = excluded.address,
         type = excluded.type,
         email = excluded.email,
         notes = excluded.notes`,
      validatedData.phoneNumber,
      validatedData.name,
      validatedData.address || null,
      validatedData.type || null,
      validatedData.email || null,
      validatedData.notes || null,
    );
    
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  } finally {
    await db.close();
  }
}

export async function getContacts(): Promise<CrmContact[]> {
    const db = await getDbConnection();
    try {
        const contacts = await db.all<CrmContact[]>('SELECT * FROM crm_contacts ORDER BY name ASC');
        return contacts;
    } finally {
        await db.close();
    }
}
