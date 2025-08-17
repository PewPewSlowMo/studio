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
    // Regex to extract the extension number (e.g., '0100') from a channel string like 'PJSIP/0100-000002d8' or 'Local/0003@from-queue-...'
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

    // Determine the correct queue number. If the call comes from 'ext-queues', the destination number ('dst') is the queue number.
    const queue = row.dcontext === 'ext-queues' ? row.dst : row.dcontext;

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
        
        // Date range is always required
        const fromDate = new Date(params.from);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(params.to);
        toDate.setHours(23, 59, 59, 999);
        whereClauses.push(`calldate BETWEEN ? AND ?`);
        queryParams.push(fromDate, toDate);
        
        // This is the core logic to handle call statistics correctly, avoiding duplicates from queue calls.
        // It selects the final, answered leg of a call if it exists, otherwise it falls back to other records.
        const baseQuery = `
            SELECT * FROM cdr
            WHERE uniqueid IN (
                SELECT t.uniqueid FROM (
                    SELECT 
                        uniqueid,
                        -- Prioritize the answered call that is NOT a queue call itself
                        ROW_NUMBER() OVER(PARTITION BY linkedid ORDER BY (disposition = 'ANSWERED' AND dcontext != 'ext-queues') DESC, calldate DESC) as rn
                    FROM cdr
                ) t
                WHERE t.rn = 1
            )
        `;

        if (params.operatorExtension) {
            // These sub-queries select the correct `linkedid`s for the operator first, then the main query selects the final call leg.
            switch (params.callType) {
                case 'answered':
                    whereClauses.push(`linkedid IN (SELECT linkedid FROM cdr WHERE dstchannel LIKE ? AND disposition = 'ANSWERED')`);
                    queryParams.push(`%/${params.operatorExtension}%`);
                    break;
                case 'outgoing':
                    whereClauses.push(`dcontext = 'from-internal' AND src = ?`);
                    queryParams.push(params.operatorExtension);
                    break;
                case 'missed':
                     // Find all call groups (linkedid) where this operator was supposed to answer but didn't
                    whereClauses.push(`linkedid IN (SELECT linkedid FROM cdr WHERE dstchannel LIKE ? AND disposition != 'ANSWERED')`);
                    queryParams.push(`%/${params.operatorExtension}%`);
                     // And ensure that no one else in that group answered it either
                    whereClauses.push(`disposition != 'ANSWERED'`);
                    break;
                default:
                    whereClauses.push(`( (dcontext = 'from-internal' AND src = ?) OR (linkedid IN (SELECT linkedid FROM cdr WHERE dstchannel LIKE ?)) )`);
                    queryParams.push(params.operatorExtension, `%/${params.operatorExtension}%`);
                    break;
            }
        }
        
        const whereSql = whereClauses.length > 0 ? `AND ${whereClauses.join(' AND ')}` : '';
        
        const finalQuery = `${baseQuery} ${whereSql}`;

        // Count query
        const countSql = `SELECT COUNT(*) as total FROM (${finalQuery}) as subquery`;
        const [countRows] = await dbConnection.execute(countSql, queryParams);
        const total = (countRows as any)[0].total;

        // Data query
        const dataSelect = `SELECT 
                calldate, clid, src, dst, dcontext, channel, dstchannel, 
                lastapp, lastdata, duration, billsec, disposition, uniqueid, linkedid, userfield, recordingfile`;
        
        let dataSql = `${dataSelect} FROM (${finalQuery}) as final_subquery ORDER BY calldate DESC`;
        
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

        // First, find the primary call record (either by uniqueid or linkedid)
        const primaryCallSql = `${baseQuery} WHERE uniqueid = ? OR linkedid = ? LIMIT 1`;
        const [primaryRows] = await dbConnection.execute(primaryCallSql, [callId, callId]);
        const primaryResults = primaryRows as any[];
        
        if (primaryResults.length === 0) {
            console.warn(`[CDR] Call not found for ID: ${callId}.`);
            return { success: false, error: 'Call not found' };
        }
        
        const primaryCall = primaryResults[0];

        // If the primary call record already has a recording file, use it.
        // Otherwise, it means this was likely an operator's leg of the call, so we find the "parent" queue call record
        // using the linkedid to get the recording file.
        if (primaryCall.recordingfile && primaryCall.recordingfile.length > 0) {
            const call: Call = mapRowToCall(primaryCall);
            return { success: true, data: call };
        } else {
             console.log(`[CDR] No recording on primary record ${callId}. Searching for parent with linkedid ${primaryCall.linkedid}...`);
             const parentCallSql = `${baseQuery} WHERE linkedid = ? AND recordingfile IS NOT NULL AND recordingfile != '' LIMIT 1`;
             const [parentRows] = await dbConnection.execute(parentCallSql, [primaryCall.linkedid]);
             const parentResults = parentRows as any[];

             if (parentResults.length > 0) {
                // We found the parent with the recording file.
                // We'll use the parent's recording file but the primary call's details.
                const parentCall = parentResults[0];
                const enrichedCall = { ...primaryCall, recordingfile: parentCall.recordingfile };
                const call: Call = mapRowToCall(enrichedCall);
                return { success: true, data: call };
             } else {
                 console.warn(`[CDR] Could not find a parent record with a recording for linkedid ${primaryCall.linkedid}`);
                 // Fallback to returning the original call data without a recording.
                 const call: Call = mapRowToCall(primaryCall);
                 return { success: true, data: call };
             }
        }

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
        
        const whereClauses: string[] = [];
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
        
        // This query finds all unique call groups (by linkedid) where no call was answered.
        const baseQuery = `
            SELECT linkedid
            FROM cdr
            ${whereSql}
            GROUP BY linkedid
            HAVING SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) = 0
        `;

        // Count query
        const countSql = `SELECT COUNT(*) as total FROM (${baseQuery}) as subquery`;
        const [countRows] = await dbConnection.execute(countSql, sqlParams);
        const total = (countRows as any)[0].total;
        
        // Data query: Get the first entry for each of those missed call groups
        let sql = `
            SELECT t1.*
            FROM cdr t1
            INNER JOIN (
                SELECT linkedid, MIN(calldate) as min_calldate
                FROM cdr
                WHERE linkedid IN (${baseQuery})
                GROUP BY linkedid
            ) t2 ON t1.linkedid = t2.linkedid AND t1.calldate = t2.min_calldate
            ORDER BY t1.calldate DESC
        `;
        
        if (params.limit && params.page) {
            sql += ` LIMIT ? OFFSET ?`;
            // Add params for the outer query and the subquery
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
