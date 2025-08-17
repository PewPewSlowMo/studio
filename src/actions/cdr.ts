
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

export interface GetCallHistoryParams extends DateRangeParams {
    operatorExtension?: string;
    callType?: 'answered' | 'outgoing' | 'missed';
    fetchAll?: boolean;
    page?: number;
    limit?: number;
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
): Promise<{ success: boolean; data?: any; error?: string }> {
  let dbConnection;
  try {
    CdrConnectionSchema.parse(connection);
    dbConnection = await createCdrConnection(connection);
    const [rows] = await dbConnection.execute("SELECT VERSION() as version;");
    const result = (rows as any)[0];
    return { success: true, data: { version: result.version } };
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

function mapRowToCall(row: any): Call {
    const operatorExtMatch = row.dstchannel?.match(/(?:PJSIP|SIP)\/(\d+)/);
    const operatorExtension = operatorExtMatch ? operatorExtMatch[1] : undefined;
    const waitTime = row.duration - row.billsec;

    let satisfaction: string | undefined = undefined;
    if (row.userfield) {
        const voteMatch = row.userfield.match(/Vote:\s*(\d+)/);
        if (voteMatch && voteMatch[1]) {
            satisfaction = voteMatch[1];
        }
    }

    return {
        id: row.uniqueid,
        linkedId: row.linkedid,
        callerNumber: row.src,
        calledNumber: row.dst,
        operatorExtension: operatorExtension,
        status: row.disposition, // 'ANSWERED', 'NO ANSWER', 'BUSY'
        startTime: row.calldate.toISOString(),
        duration: row.duration, // Full duration from dial to hangup
        billsec: row.billsec, // Talk time
        waitTime: waitTime >= 0 ? waitTime : 0, // wait time before answer
        queue: row.dcontext,
        isOutgoing: row.dcontext === 'from-internal',
        satisfaction: satisfaction,
        recordingfile: row.recordingfile || undefined,
    }
}

export async function getCallHistory(connection: CdrConnection, params: GetCallHistoryParams): Promise<{ success: boolean; data?: Call[], total?: number, error?: string }> {
    let dbConnection;
    try {
        dbConnection = await createCdrConnection(connection);
        
        const whereClauses: string[] = [];
        const queryParams: any[] = [];
        
        // Date range is always required
        const fromDate = new Date(params.from);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(params.to);
        toDate.setHours(23, 59, 59, 999);
        whereClauses.push(`calldate BETWEEN ? AND ?`);
        queryParams.push(fromDate, toDate);
        
        if (params.operatorExtension) {
            switch (params.callType) {
                case 'answered':
                    whereClauses.push(`dstchannel LIKE ? AND disposition = 'ANSWERED'`);
                    queryParams.push(`%/${params.operatorExtension}%`);
                    break;
                case 'outgoing':
                    whereClauses.push(`dcontext = 'from-internal' AND src = ?`);
                    queryParams.push(params.operatorExtension);
                    break;
                case 'missed':
                    whereClauses.push(`dstchannel LIKE ? AND disposition != 'ANSWERED'`);
                    queryParams.push(`%/${params.operatorExtension}%`);
                    break;
                // Default case if callType is not provided but extension is (used for operator's general history)
                default:
                    whereClauses.push(`( (dcontext = 'from-internal' AND src = ?) OR (dstchannel LIKE ?) )`);
                    queryParams.push(params.operatorExtension, `%/${params.operatorExtension}%`);
                    break;
            }
        }
        
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        
        // Count query
        const countSql = `SELECT COUNT(*) as total FROM cdr ${whereSql}`;
        const [countRows] = await dbConnection.execute(countSql, queryParams);
        const total = (countRows as any)[0].total;

        // Data query
        const dataSelect = `SELECT 
                calldate, clid, src, dst, dcontext, channel, dstchannel, 
                lastapp, lastdata, duration, billsec, disposition, uniqueid, linkedid, userfield, recordingfile`;
        
        let dataSql = `${dataSelect} FROM cdr ${whereSql} ORDER BY calldate DESC`;
        
        if (!params.fetchAll && params.limit && params.page) {
            dataSql += ` LIMIT ? OFFSET ?`;
            queryParams.push(params.limit, (params.page - 1) * params.limit);
        }
        
        const [rows] = await dbConnection.execute(dataSql, queryParams);
        const calls = (rows as any[]).map(mapRowToCall);

        return { success: true, data: calls, total };

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
        
        const baseQuery = `SELECT 
            calldate, clid, src, dst, dcontext, channel, dstchannel, 
            lastapp, lastdata, duration, billsec, disposition, uniqueid, linkedid, userfield, recordingfile
            FROM cdr`;

        // 1. Try to find by exact match first on both uniqueid and linkedid
        const exactSql = `${baseQuery} WHERE (uniqueid = ? OR linkedid = ?) ORDER BY calldate DESC LIMIT 1`;
        let [rows] = await dbConnection.execute(exactSql, [callId, callId]);
        let results = rows as any[];
        
        // 2. If no exact match, fall back to "flexible" LIKE search on the base ID
        if (results.length === 0) {
            console.log(`[CDR] Exact match for ${callId} not found. Trying flexible search...`);
            const callIdBase = callId.includes('.') ? callId.substring(0, callId.lastIndexOf('.')) : callId;
            const searchTerm = `${callIdBase}.%`;
            const likeSql = `${baseQuery} WHERE (uniqueid LIKE ? OR linkedid LIKE ?) ORDER BY calldate DESC LIMIT 1`;
            [rows] = await dbConnection.execute(likeSql, [searchTerm, searchTerm]);
            results = rows as any[];
        }

        if (results.length === 0) {
             console.warn(`[CDR] Call not found for ID: ${callId} even with flexible search.`);
            return { success: false, error: 'Call not found' };
        }

        const call: Call = mapRowToCall(results[0]);

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

export async function getMissedCalls(connection: CdrConnection, params: DateRangeParams & { page?: number, limit?: number }): Promise<{ success: boolean; data?: Call[], total?: number, error?: string }> {
    let dbConnection;
    try {
        dbConnection = await createCdrConnection(connection);
        
        const whereClauses: string[] = [`disposition != 'ANSWERED'`];
        const sqlParams: any[] = [];

        if (params.from && params.to) {
            whereClauses.push(`calldate BETWEEN ? AND ?`);
            const fromDate = new Date(params.from);
            fromDate.setHours(0, 0, 0, 0);

            const toDate = new Date(params.to);
            toDate.setHours(23, 59, 59, 999);
            sqlParams.push(fromDate, toDate);
        } else {
             whereClauses.push(`calldate >= NOW() - INTERVAL 1 DAY`);
        }

        const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
        
        const countSql = `SELECT COUNT(*) as total FROM cdr ${whereSql}`;
        const [countRows] = await dbConnection.execute(countSql, sqlParams);
        const total = (countRows as any)[0].total;
        
        let sql = `SELECT 
                calldate, clid, src, dst, dcontext, channel, dstchannel, 
                lastapp, lastdata, duration, billsec, disposition, uniqueid, linkedid, userfield, recordingfile
             FROM cdr ${whereSql} ORDER BY calldate DESC`;
        
        if (params.limit && params.page) {
            sql += ` LIMIT ? OFFSET ?`;
            sqlParams.push(params.limit, (params.page - 1) * params.limit);
        }
        
        const [rows] = await dbConnection.execute(sql, sqlParams);
        const calls = (rows as any[]).map(mapRowToCall);

        return { success: true, data: calls, total };

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
