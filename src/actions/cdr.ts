
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

const CDR_VIEW_NAME = 'cdr_distinct_latest';

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
    const operatorExtMatch = row.dstchannel?.match(/(?:PJSIP|SIP|Local)\/(\d+)/);
    const operatorExtension = operatorExtMatch ? operatorExtMatch[1] : undefined;
    const waitTime = row.duration - row.billsec;

    let satisfaction: string | undefined = undefined;
    if (row.userfield) {
        const voteMatch = row.userfield.match(/Vote:\s*(\d+)/);
        if (voteMatch && voteMatch[1]) {
            satisfaction = voteMatch[1];
        }
    }
    
    // If context is 'ext-queues', the queue number is in 'dst'
    const queue = row.dcontext === 'ext-queues' ? row.dst : row.dcontext;

    return {
        id: row.uniqueid,
        linkedId: row.linkedid,
        callerNumber: row.src,
        calledNumber: row.dst,
        operatorExtension: operatorExtension,
        status: row.disposition,
        startTime: row.calldate.toISOString(),
        duration: row.duration,
        billsec: row.billsec,
        waitTime: waitTime >= 0 ? waitTime : 0,
        queue: queue,
        isOutgoing: row.dcontext === 'from-internal',
        satisfaction: satisfaction,
        recordingfile: row.recordingfile || undefined,
    }
}

export async function getCallHistory(connection: CdrConnection, params: GetCallHistoryParams): Promise<{ success: boolean; data?: Call[], total?: number, error?: string }> {
    let dbConnection;
    try {
        dbConnection = await createCdrConnection(connection);
        
        let whereClauses: string[] = [];
        const queryParams: any[] = [];
        
        const fromDate = new Date(params.from);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(params.to);
        toDate.setHours(23, 59, 59, 999);
        whereClauses.push(`calldate BETWEEN ? AND ?`);
        queryParams.push(fromDate, toDate);
        
        if (params.operatorExtension) {
             switch (params.callType) {
                case 'answered':
                    // Incoming answered calls
                    whereClauses.push(`dstchannel LIKE ? AND disposition = 'ANSWERED' AND dcontext != 'from-internal'`);
                    queryParams.push(`%/${params.operatorExtension}%`);
                    break;
                case 'outgoing':
                    // Outgoing calls from operator
                    whereClauses.push(`src = ? AND dcontext = 'from-internal'`);
                    queryParams.push(params.operatorExtension);
                    break;
                case 'missed':
                    // Incoming missed calls for that operator
                    whereClauses.push(`dstchannel LIKE ? AND disposition != 'ANSWERED' AND dcontext != 'from-internal'`);
                    queryParams.push(`%/${params.operatorExtension}%`);
                    break;
                default:
                    // All calls related to the operator
                    const operatorClause = `( (dcontext = 'from-internal' AND src = ?) OR (dstchannel LIKE ?) )`;
                    whereClauses.push(operatorClause);
                    queryParams.push(params.operatorExtension, `%/${params.operatorExtension}%`);
                    break;
            }
        }
        
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Query for total count
        const countQuery = `SELECT COUNT(*) as total FROM ${CDR_VIEW_NAME} ${whereSql}`;
        const [countResult] = await dbConnection.execute(countQuery, queryParams);
        const total = (countResult as any)[0].total;

        // Query for paginated data
        let dataQuery = `SELECT * FROM ${CDR_VIEW_NAME} ${whereSql} ORDER BY calldate DESC`;
        if (!params.fetchAll && params.limit && params.page) {
            dataQuery += ` LIMIT ? OFFSET ?`;
            queryParams.push(params.limit, (params.page - 1) * params.limit);
        }
        
        const [rows] = await dbConnection.execute(dataQuery, queryParams);
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
        
        // Using the VIEW simplifies this greatly. We just need to find the one distinct record.
        const sql = `SELECT * FROM ${CDR_VIEW_NAME} WHERE uniqueid = ? OR uniqueid LIKE ? LIMIT 1`;
        const callIdBase = callId.split('.')[0];
        const [rows] = await dbConnection.execute(sql, [callId, `${callIdBase}.%`]);
        
        if ((rows as any[]).length === 0) {
            console.warn(`[CDR] Distinct call not found for ID: ${callId}.`);
            return { success: false, error: 'Call not found in distinct view' };
        }
        
        const call = (rows as any[])[0];
        
        // If the found record has no recording file, let's check other records with the same linkedid
        if (!call.recordingfile && call.linkedid) {
            const recordingSql = `SELECT recordingfile FROM cdr WHERE linkedid = ? AND recordingfile IS NOT NULL AND recordingfile != '' LIMIT 1`;
            const [recordingRows] = await dbConnection.execute(recordingSql, [call.linkedid]);
            if ((recordingRows as any[]).length > 0) {
                call.recordingfile = (recordingRows as any[])[0].recordingfile;
            }
        }

        return { success: true, data: mapRowToCall(call) };

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred.';
        console.error('getCallById failed for callId', callId, ':', message);
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
        
        const whereClauses: string[] = ["disposition != 'ANSWERED'", "dcontext != 'from-internal'"];
        const queryParams: any[] = [];

        if (params.from && params.to) {
            whereClauses.push(`calldate BETWEEN ? AND ?`);
            const fromDate = new Date(params.from);
            fromDate.setHours(0, 0, 0, 0);

            const toDate = new Date(params.to);
            toDate.setHours(23, 59, 59, 999);
            queryParams.push(fromDate, toDate);
        } else {
             whereClauses.push(`calldate >= NOW() - INTERVAL 1 DAY`);
        }

        const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
        
        const countQuery = `SELECT COUNT(*) as total FROM ${CDR_VIEW_NAME} ${whereSql}`;
        const [countResult] = await dbConnection.execute(countQuery, queryParams);
        const total = (countResult as any)[0].total;
        
        let dataQuery = `SELECT * FROM ${CDR_VIEW_NAME} ${whereSql} ORDER BY calldate DESC`;
        
        if (params.limit && params.page) {
            dataQuery += ` LIMIT ? OFFSET ?`;
            queryParams.push(params.limit, (params.page - 1) * params.limit);
        }
        
        const [rows] = await dbConnection.execute(dataQuery, queryParams);
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
