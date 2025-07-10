'use server';

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';
import type { User, CrmContact, Appeal } from '@/lib/types';

// The database file will be stored in the `data` directory.
const DB_PATH = path.join(process.cwd(), 'data', 'app.db');
const USERS_JSON_PATH = path.join(process.cwd(), 'data', 'users.json');
const CRM_JSON_PATH = path.join(process.cwd(), 'data', 'crm.json');
const APPEALS_JSON_PATH = path.join(process.cwd(), 'data', 'appeals.json');


/**
 * Creates and returns a database connection instance.
 * It will create the database file if it doesn't exist.
 */
export async function getDbConnection() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });
  // Enable WAL mode for better concurrency. This allows multiple readers and one writer.
  await db.exec('PRAGMA journal_mode = WAL;');
  return db;
}

/**
 * Initializes the database schema and performs a one-time migration from JSON files if needed.
 * This function should be called when the application starts
 * to ensure all necessary tables are created.
 */
export async function initializeDatabase() {
  const db = await getDbConnection();
  
  // Enable foreign key support
  await db.exec('PRAGMA foreign_keys = ON;');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TEXT NOT NULL,
      extension TEXT,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crm_contacts (
      phoneNumber TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      type TEXT,
      email TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS appeals (
      id TEXT PRIMARY KEY,
      callId TEXT NOT NULL,
      operatorId TEXT NOT NULL,
      operatorName TEXT NOT NULL,
      callerNumber TEXT NOT NULL,
      description TEXT,
      resolution TEXT,
      category TEXT,
      priority TEXT,
      satisfaction TEXT,
      notes TEXT,
      followUp BOOLEAN NOT NULL DEFAULT FALSE,
      followUpCompleted BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (operatorId) REFERENCES users (id) ON DELETE SET NULL,
      FOREIGN KEY (callerNumber) REFERENCES crm_contacts (phoneNumber) ON DELETE CASCADE
    );
  `);
  
  // One-time migration functions
  const migrateFromJson = async (tableName: string, jsonPath: string, insertStatement: string, dataMapper: (item: any) => any[]) => {
      const countResult = await db.get(`SELECT COUNT(*) as count FROM ${tableName}`);
      if (countResult.count === 0) {
          console.log(`${tableName} table is empty. Attempting to migrate from ${path.basename(jsonPath)}...`);
          try {
              const data = await fs.readFile(jsonPath, 'utf-8');
              const items = JSON.parse(data);
              
              if (items.length > 0) {
                  const stmt = await db.prepare(insertStatement);
                  for (const item of items) {
                      await stmt.run(...dataMapper(item));
                  }
                  await stmt.finalize();
                  console.log(`Successfully migrated ${items.length} items to ${tableName} from ${path.basename(jsonPath)}.`);
              }
          } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                  console.error(`Failed to migrate to ${tableName} from ${path.basename(jsonPath)}:`, error);
              } else {
                  console.log(`${path.basename(jsonPath)} not found, skipping migration.`);
              }
          }
      }
  };

  // Migrate Users
  await migrateFromJson(
      'users', 
      USERS_JSON_PATH, 
      'INSERT INTO users (id, username, email, name, role, isActive, createdAt, extension, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      (user: User) => [user.id, user.username, user.email, user.name, user.role, user.isActive, user.createdAt, user.extension || null, user.password]
  );
  
  // Migrate CRM Contacts
  await migrateFromJson(
      'crm_contacts',
      CRM_JSON_PATH,
      'INSERT INTO crm_contacts (phoneNumber, name, address, type, email, notes) VALUES (?, ?, ?, ?, ?, ?)',
      (contact: CrmContact) => [contact.phoneNumber, contact.name, contact.address, contact.type, contact.email || null, contact.notes || null]
  );

  // Migrate Appeals
  await migrateFromJson(
      'appeals',
      APPEALS_JSON_PATH,
      'INSERT INTO appeals (id, callId, operatorId, operatorName, callerNumber, description, resolution, category, priority, satisfaction, notes, followUp, followUpCompleted, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      (appeal: Appeal) => [
          appeal.id, appeal.callId, appeal.operatorId, appeal.operatorName, appeal.callerNumber,
          appeal.description, appeal.resolution, appeal.category, appeal.priority, appeal.satisfaction,
          appeal.notes || null, appeal.followUp, appeal.followUpCompleted || false, appeal.createdAt
      ]
  );


  await db.close();
}

/**
 * A simple function to test the database connection by running a basic query.
 */
export async function testAppDbConnection(): Promise<{ success: boolean; error?: string, data?: any }> {
    let db;
    try {
        db = await getDbConnection();
        const result = await db.get('SELECT sqlite_version() as version');
        await db.close();
        return { success: true, data: result };
    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred.';
        console.error('testAppDbConnection failed:', message);
        if (db) await db.close();
        return { success: false, error: message };
    }
}
