
'use server';

import { z } from 'zod';
import mysql from 'mysql2/promise';
import type { Call } from '@/lib/types';
import { writeToLog } from './logger';

const LOG_COMPONENT = 'CDR_ACTION';

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
    callType?: 'answered' | 'outgoing' | 'missed' | 'all'; // Added 'all' for clarity
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


/**
 * New implementation using the two-pass approach to handle duplicates without a VIEW.
 */
export async function getCallHistory(connection: CdrConnection, params: GetCallHistoryParams): Promise<{ success: boolean; data?: Call[], total?: number, error?: string }> {
    let dbConnection;
    try {
        dbConnection = await createCdrConnection(connection);

        // --- STEP 1: Build WHERE clause for finding relevant calls ---
        let whereClauses: string[] = [];
        const queryParams: any[] = [];
        
        const fromDate = new Date(params.from);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(params.to);
        toDate.setHours(23, 59, 59, 999);

        whereClauses.push(`calldate BETWEEN ? AND ?`);
        queryParams.push(fromDate, toDate);
        
        if (params.operatorExtension) {
             const callType = params.callType || 'all';
             switch (callType) {
                case 'answered':
                    whereClauses.push(`dstchannel LIKE ? AND disposition = 'ANSWERED' AND dcontext != 'from-internal'`);
                    queryParams.push(`%/${params.operatorExtension}%`);
                    break;
                case 'outgoing':
                    whereClauses.push(`src = ? AND dcontext = 'from-internal'`);
                    queryParams.push(params.operatorExtension);
                    break;
                case 'missed':
                    whereClauses.push(`dstchannel LIKE ? AND disposition != 'ANSWERED' AND dcontext != 'from-internal'`);
                    queryParams.push(`%/${params.operatorExtension}%`);
                    break;
                case 'all':
                    const operatorClause = `( (dcontext = 'from-internal' AND src = ?) OR (dstchannel LIKE ?) )`;
                    whereClauses.push(operatorClause);
                    queryParams.push(params.operatorExtension, `%/${params.operatorExtension}%`);
                    break;
            }
        }
        
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // --- STEP 2: Get the total count of unique calls (unique linkedids) ---
        const countQuery = `SELECT COUNT(DISTINCT COALESCE(NULLIF(linkedid, ''), uniqueid)) as total FROM cdr ${whereSql}`;
        const [countResult] = await dbConnection.execute(countQuery, queryParams);
        const total = (countResult as any)[0].total;

        // --- STEP 3: Get the group_ids for the current page ---
        let mainKeysQuery = `
            SELECT COALESCE(NULLIF(linkedid, ''), uniqueid) as group_id
            FROM cdr
            ${whereSql}
            GROUP BY group_id
            ORDER BY MAX(calldate) DESC
        `;
        
        const paginatedQueryParams = [...queryParams];
        if (!params.fetchAll && params.limit && params.page) {
            mainKeysQuery += ` LIMIT ? OFFSET ?`;
            paginatedQueryParams.push(params.limit, (params.page - 1) * params.limit);
        }
        
        const [keyRows] = await dbConnection.execute(mainKeysQuery, paginatedQueryParams);
        const groupIds = (keyRows as any[]).map(r => r.group_id);

        if (groupIds.length === 0) {
            return { success: true, data: [], total: 0 };
        }

        // --- STEP 4: Fetch the best row for each of the paginated group_ids ---
        const placeholders = groupIds.map(() => '?').join(',');
        const finalQuery = `
            SELECT c.*
            FROM cdr c
            INNER JOIN (
                SELECT 
                    COALESCE(NULLIF(linkedid, ''), uniqueid) as group_id,
                    MAX(sequence) as max_sequence
                FROM cdr
                WHERE COALESCE(NULLIF(linkedid, ''), uniqueid) IN (${placeholders})
                GROUP BY group_id
            ) g ON COALESCE(NULLIF(c.linkedid, ''), c.uniqueid) = g.group_id AND c.sequence = g.max_sequence
            ORDER BY c.calldate DESC
        `;

        const [finalRows] = await dbConnection.execute(finalQuery, groupIds);
        const calls = (finalRows as any[]).map(mapRowToCall);

        return { success: true, data: calls, total };

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred.';
        await writeToLog(LOG_COMPONENT, { level: 'ERROR', message: 'getCallHistory failed', error: message });
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
        
        const findLinkedIdQuery = `SELECT linkedid FROM cdr WHERE uniqueid = ? AND linkedid IS NOT NULL AND linkedid != '' LIMIT 1`;
        const [linkedIdRows] = await dbConnection.execute(findLinkedIdQuery, [callId]);
        const linkedId = (linkedIdRows as any[])[0]?.linkedid || callId;
        
        // Find the row with the longest talk time for this call group
        const bestRowQuery = `
            SELECT * FROM cdr 
            WHERE COALESCE(NULLIF(linkedid, ''), uniqueid) = ?
            ORDER BY disposition = 'ANSWERED' DESC, billsec DESC, sequence DESC 
            LIMIT 1
        `;
        const [rows] = await dbConnection.execute(bestRowQuery, [linkedId]);
        
        if ((rows as any[]).length === 0) {
            return { success: false, error: `Call not found for ID or linkedId: ${linkedId}` };
        }
        
        const callData = (rows as any[])[0];
        
        // If the best row doesn't have a recording file, search for it across all related records.
        if (!callData.recordingfile && callData.linkedid) {
            const recordingSql = `SELECT recordingfile FROM cdr WHERE linkedid = ? AND recordingfile IS NOT NULL AND recordingfile != '' LIMIT 1`;
            const [recordingRows] = await dbConnection.execute(recordingSql, [callData.linkedid]);
            if ((recordingRows as any[]).length > 0) {
                callData.recordingfile = (recordingRows as any[])[0].recordingfile;
            }
        }

        return { success: true, data: mapRowToCall(callData) };

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred.';
        await writeToLog(LOG_COMPONENT, { level: 'ERROR', message: `getCallById failed for callId ${callId}`, error: message });
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
        
        // Count unique missed calls
        const countQuery = `SELECT COUNT(DISTINCT COALESCE(NULLIF(linkedid, ''), uniqueid)) as total FROM cdr ${whereSql}`;
        const [countResult] = await dbConnection.execute(countQuery, queryParams);
        const total = (countResult as any)[0].total;
        
        // Get group_ids for the current page
        const mainKeysQuery = `
            SELECT COALESCE(NULLIF(linkedid, ''), uniqueid) as group_id
            FROM cdr
            ${whereSql}
            GROUP BY group_id
            ORDER BY MAX(calldate) DESC
            LIMIT ? OFFSET ?
        `;
        const paginatedQueryParams = [...queryParams, params.limit || 20, ((params.page || 1) - 1) * (params.limit || 20)];
        const [keyRows] = await dbConnection.execute(mainKeysQuery, paginatedQueryParams);
        const groupIds = (keyRows as any[]).map(r => r.group_id);

        if (groupIds.length === 0) {
            return { success: true, data: [], total: 0 };
        }

        // Fetch the best row for each of the paginated group_ids
        const placeholders = groupIds.map(() => '?').join(',');
        const finalQuery = `
            SELECT c.*
            FROM cdr c
            INNER JOIN (
                SELECT 
                    COALESCE(NULLIF(linkedid, ''), uniqueid) as group_id,
                    MAX(sequence) as max_sequence
                FROM cdr
                WHERE COALESCE(NULLIF(linkedid, ''), uniqueid) IN (${placeholders})
                GROUP BY group_id
            ) g ON COALESCE(NULLIF(c.linkedid, ''), c.uniqueid) = g.group_id AND c.sequence = g.max_sequence
            ORDER BY c.calldate DESC
        `;
        
        const [finalRows] = await dbConnection.execute(finalQuery, groupIds);
        const calls = (finalRows as any[]).map(mapRowToCall);

        return { success: true, data: calls, total };

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred.';
        await writeToLog(LOG_COMPONENT, { level: 'ERROR', message: 'getMissedCalls failed', error: message });
        return { success: false, error: message };
    } finally {
        if (dbConnection) {
            await dbConnection.end();
        }
    }
}

    