'use server';

import mysql from 'mysql2/promise';
import { z } from 'zod';
import { getConfig } from './config';

const DbConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.string().min(1, 'Port is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string(),
  database: z.string().min(1, 'Database name is required'),
});

type DbConnection = z.infer<typeof DbConnectionSchema>;

export async function createAppDbConnection() {
  const config = await getConfig();
  const validatedConnection = DbConnectionSchema.parse(config.app_db);
  return await mysql.createConnection({
    host: validatedConnection.host,
    port: Number(validatedConnection.port),
    user: validatedConnection.username,
    password: validatedConnection.password,
    database: validatedConnection.database,
  });
}

export async function testAppDbConnection(
  connection: DbConnection
): Promise<{ success: boolean; error?: string }> {
  let dbConnection;
  try {
    DbConnectionSchema.parse(connection);
    dbConnection = await mysql.createConnection({
        host: connection.host,
        port: Number(connection.port),
        user: connection.username,
        password: connection.password,
        database: connection.database,
    });
    await dbConnection.ping();
    return { success: true };

  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: `Invalid input: ${e.errors.map((err) => err.message).join(', ')}` };
    }
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error('testAppDbConnection failed:', message);
    return { success: false, error: message };
  } finally {
      if (dbConnection) {
          await dbConnection.end();
      }
  }
}
