
'use server';

import { z } from 'zod';
import mysql from 'mysql2/promise';
import type { Call } from '@/lib/types';

const CdrConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.string().min(1, 'Port is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string(),
  database: z.string().min(1, 'Database name is required'),
});

type CdrConnection = z.infer<typeof CdrConnectionSchema>;

export interface DateRangeParams {
    from: string; // ISO string date
    to: string;   // ISO string date
}

async function createCdrConnection(connection: CdrConnection) {
    const validatedConnection = CdrConnectionSchema.parse(connection);
    return await mysql.createConnection({
        host: validatedConnection.host,
        port: Number(validatedConnection.port),
        user: validatedConnection.username,
        password: validatedConnection.password,
        database: validatedConnection.database,
    });
}

export async function testCdrConnection(
  connection: CdrConnection
): Promise<{ success: boolean; error?: string }> {
  let dbConnection;
  try {
    CdrConnectionSchema.parse(connection);
    dbConnection = await createCdrConnection(connection);
    await dbConnection.ping();
    return { success: true };

  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, error: `Invalid input: ${e.errors.map((err) => err.message).join(', ')}` };
    }
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error('testCdrConnection failed:', message);
    return { success: false, error: message };
  } finally {
      if (dbConnection) {
          await dbConnection.end();
      }
  }
}

export async function getCallHistory(connection: CdrConnection, dateRange?: DateRangeParams): Promise<{ success: boolean; data?: Call[], error?: string }> {
    let dbConnection;
    try {
        dbConnection = await createCdrConnection(connection);
        
        let sql = `SELECT 
                calldate, clid, src, dst, dcontext, channel, dstchannel, 
                lastapp, lastdata, duration, billsec, disposition, uniqueid 
             FROM cdr`;
        
        const params: any[] = [];
        
        if (dateRange?.from && dateRange?.to) {
            sql += ` WHERE calldate BETWEEN ? AND ?`;
            const fromDate = new Date(dateRange.from);
            fromDate.setHours(0, 0, 0, 0);

            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);

            params.push(fromDate, toDate);
        } else {
             sql += ` WHERE calldate >= NOW() - INTERVAL 1 DAY`;
        }

        sql += ` ORDER BY calldate DESC`;
        
        const [rows] = await dbConnection.execute(sql, params);

        const calls = (rows as any[]).map((row): Call => {
            const operatorExtMatch = row.dstchannel?.match(/(?:PJSIP|SIP)\/(\d+)/);
            const operatorExtension = operatorExtMatch ? operatorExtMatch[1] : undefined;
            const waitTime = row.duration - row.billsec;

            return {
                id: row.uniqueid,
                callerNumber: row.src,
                calledNumber: row.dst,
                operatorExtension: operatorExtension,
                status: row.disposition, // 'ANSWERED', 'NO ANSWER', 'BUSY'
                startTime: row.calldate.toISOString(),
                duration: row.duration, // Full duration from dial to hangup
                billsec: row.billsec, // Talk time
                waitTime: waitTime >= 0 ? waitTime : 0, // wait time before answer
                queue: row.dcontext,
            }
        });

        return { success: true, data: calls };

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred.';
        console.error('getCallHistory failed:', message);
        return { success: false, error: message };
    } finally {
        if (dbConnection) {
            await dbConnection.end();
        }
    }
}

export async function getCallById(connection: CdrConnection, callId: string): Promise<{ success: boolean; data?: Call, error?: string }> {
    let dbConnection;
    try {
        dbConnection = await createCdrConnection(connection);
        
        const callIdBase = callId.includes('.') ? callId.substring(0, callId.lastIndexOf('.')) : callId;
        const searchTerm = `${callIdBase}.%`;

        const sql = `SELECT 
                calldate, clid, src, dst, dcontext, channel, dstchannel, 
                lastapp, lastdata, duration, billsec, disposition, uniqueid 
             FROM cdr WHERE (uniqueid LIKE ? OR linkedid LIKE ? OR uniqueid = ? OR linkedid = ?) ORDER BY calldate DESC LIMIT 1`;
        
        const [rows] = await dbConnection.execute(sql, [searchTerm, searchTerm, callId, callId]);
        const results = rows as any[];

        if (results.length === 0) {
            return { success: false, error: 'Call not found' };
        }

        const row = results[0];
        const operatorExtMatch = row.dstchannel?.match(/(?:PJSIP|SIP)\/(\d+)/);
        const operatorExtension = operatorExtMatch ? operatorExtMatch[1] : undefined;
        const waitTime = row.duration - row.billsec;

        const call: Call = {
            id: row.uniqueid,
            callerNumber: row.src,
            calledNumber: row.dst,
            operatorExtension: operatorExtension,
            status: row.disposition,
            startTime: row.calldate.toISOString(),
            duration: row.duration,
            billsec: row.billsec,
            waitTime: waitTime >= 0 ? waitTime : 0,
            queue: row.dcontext,
        };

        return { success: true, data: call };

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred.';
        console.error('getCallById failed:', message);
        return { success: false, error: message };
    } finally {
        if (dbConnection) {
            await dbConnection.end();
        }
    }
}

export async function getMissedCalls(connection: CdrConnection, dateRange?: DateRangeParams): Promise<{ success: boolean; data?: Call[], error?: string }> {
    let dbConnection;
    try {
        dbConnection = await createCdrConnection(connection);
        
        let sql = `SELECT 
                calldate, clid, src, dst, dcontext, channel, dstchannel, 
                lastapp, lastdata, duration, billsec, disposition, uniqueid 
             FROM cdr 
             WHERE disposition != 'ANSWERED'`;
        
        const params: any[] = [];
        
        if (dateRange?.from && dateRange?.to) {
            sql += ` AND calldate BETWEEN ? AND ?`;
             const fromDate = new Date(dateRange.from);
            fromDate.setHours(0, 0, 0, 0);

            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);

            params.push(fromDate, toDate);
        } else {
             sql += ` AND calldate >= NOW() - INTERVAL 1 DAY`;
        }
        
        sql += ` ORDER BY calldate DESC`;

        const [rows] = await dbConnection.execute(sql, params);

        const calls = (rows as any[]).map((row): Call => {
            return {
                id: row.uniqueid,
                callerNumber: row.src,
                calledNumber: row.dst,
                queue: row.dcontext, 
                status: row.disposition, // 'NO ANSWER', 'BUSY', 'FAILED'
                startTime: row.calldate.toISOString(),
                duration: row.duration,
                billsec: row.billsec, // Should be 0
                waitTime: row.duration, // Wait time for missed calls is the full duration
            }
        });

        return { success: true, data: calls };

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred.';
        console.error('getMissedCalls failed:', message);
        return { success: false, error: message };
    } finally {
        if (dbConnection) {
            await dbConnection.end();
        }
    }
}
