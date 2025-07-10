'use server';

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import type { Call, CrmContact } from '@/lib/types';
import { getConfig } from './config';
import { getCallHistory } from './cdr';
import { getUsers } from './users';

const CRM_DB_PATH = path.join(process.cwd(), 'data', 'crm.json');

const CrmContactSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  type: z.string().min(1, 'Type is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  notes: z.string().optional(),
});

async function readCrmData(): Promise<CrmContact[]> {
  try {
    await fs.mkdir(path.dirname(CRM_DB_PATH), { recursive: true });
    const data = await fs.readFile(CRM_DB_PATH, 'utf-8');
    return JSON.parse(data) as CrmContact[];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(CRM_DB_PATH, JSON.stringify([]), 'utf-8');
      return [];
    }
    console.error('Error reading CRM database:', error);
    throw new Error('Could not read from the CRM database.');
  }
}

async function writeCrmData(contacts: CrmContact[]): Promise<void> {
  await fs.writeFile(CRM_DB_PATH, JSON.stringify(contacts, null, 2), 'utf-8');
}


export async function findContactByPhone(phoneNumber: string): Promise<{ contact: CrmContact | null, history: Call[] }> {
    if (!phoneNumber || phoneNumber === 'anonymous') {
        return { contact: null, history: [] };
    }

    const [crmData, config, users] = await Promise.all([
        readCrmData(),
        getConfig(),
        getUsers(),
    ]);
    
    const contact = crmData.find(c => c.phoneNumber === phoneNumber) || null;
    
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

    return { contact, history };
}

export async function addOrUpdateContact(contactData: CrmContact): Promise<{ success: boolean; error?: string }> {
  try {
    const validatedData = CrmContactSchema.parse(contactData);
    const contacts = await readCrmData();
    const index = contacts.findIndex(c => c.phoneNumber === validatedData.phoneNumber);

    if (index !== -1) {
      // Update existing contact
      contacts[index] = { ...contacts[index], ...validatedData };
    } else {
      // Add new contact
      contacts.unshift(validatedData);
    }

    await writeCrmData(contacts);
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}

export async function getContacts(): Promise<CrmContact[]> {
    return readCrmData();
}
