'use server';

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';

// The database file will be stored in the `data` directory.
const DB_PATH = path.join(process.cwd(), 'data', 'app.db');

/**
 * Creates and returns a database connection instance.
 * It will create the database file if it doesn't exist.
 */
export async function getDbConnection() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });
  return db;
}

/**
 * Initializes the database schema.
 * This function should be called when the application starts
 * to ensure all necessary tables are created.
 */
export async function initializeDatabase() {
  const db = await getDbConnection();
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
      address TEXT NOT NULL,
      type TEXT NOT NULL,
      email TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS appeals (
      id TEXT PRIMARY KEY,
      callId TEXT NOT NULL,
      operatorId TEXT NOT NULL,
      operatorName TEXT NOT NULL,
      callerNumber TEXT NOT NULL,
      description TEXT NOT NULL,
      resolution TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      satisfaction TEXT NOT NULL,
      notes TEXT,
      followUp BOOLEAN NOT NULL DEFAULT FALSE,
      followUpCompleted BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TEXT NOT NULL
    );
  `);
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
