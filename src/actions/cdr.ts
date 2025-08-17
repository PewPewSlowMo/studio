
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
                default:
                    const operatorExtensionClause = `( (dcontext = 'from-internal' AND src = ?) OR (dstchannel LIKE ?) )`;
                    whereClauses.push(operatorExtensionClause);
                    queryParams.push(params.operatorExtension, `%/${params.operatorExtension}%`);
                    break;
            }
        }
        
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Step 1: Get all unique linkedids that match the criteria
        const linkedIdQuery = `SELECT DISTINCT linkedid FROM cdr ${whereSql}`;
        const [linkedIdRows] = await dbConnection.execute(linkedIdQuery, queryParams);
        const linkedIds = (linkedIdRows as any[]).map(row => row.linkedid);
        
        if (linkedIds.length === 0) {
            return { success: true, data: [], total: 0 };
        }

        // Step 2: For each linkedid, fetch the "best" record.
        // The "best" record is the one that was answered by an operator (not a queue).
        // If none were answered, we'll get the latest entry for that call group.
        const callPromises = linkedIds.map(linkedId => {
            const singleCallQuery = `
                SELECT * FROM cdr 
                WHERE linkedid = ? 
                ORDER BY 
                    (disposition = 'ANSWERED' AND dstchannel LIKE 'PJSIP/%') DESC, 
                    (disposition = 'ANSWERED') DESC,
                    calldate DESC 
                LIMIT 1`;
            return dbConnection.execute(singleCallQuery, [linkedId]);
        });
        
        const callResults = await Promise.all(callPromises);
        const calls = callResults
            .map(res => (res[0] as any[])[0])
            .filter(Boolean)
            .map(mapRowToCall);
            
        // Because we filter after fetching, we need to sort again.
        calls.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        
        const total = calls.length;

        // Apply pagination
        let paginatedCalls = calls;
        if (!params.fetchAll && params.limit && params.page) {
            const start = (params.page - 1) * params.limit;
            const end = start + params.limit;
            paginatedCalls = calls.slice(start, end);
        }

        return { success: true, data: paginatedCalls, total };

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
        
        const baseQuery = `SELECT * FROM cdr`;

        // Find the primary call record based on the uniqueid.
        // It could be the record with the file, or a record linked to it.
        const primaryCallSql = `${baseQuery} WHERE uniqueid = ? OR uniqueid LIKE ? LIMIT 1`;
        const callIdBase = callId.split('.')[0];
        const [primaryRows] = await dbConnection.execute(primaryCallSql, [callId, `${callIdBase}.%`]);
        
        if ((primaryRows as any[]).length === 0) {
            console.warn(`[CDR] Call not found for ID: ${callId}.`);
            return { success: false, error: 'Call not found' };
        }
        
        const primaryCall = (primaryRows as any[])[0];
        const linkedId = primaryCall.linkedid;

        // Now find the best record within that entire call (using linkedid)
        // We prioritize a record that is answered and has a recording file.
        const bestRecordSql = `${baseQuery} 
            WHERE linkedid = ? 
            ORDER BY 
                (disposition = 'ANSWERED' AND recordingfile IS NOT NULL AND recordingfile != '') DESC,
                (recordingfile IS NOT NULL AND recordingfile != '') DESC,
                (disposition = 'ANSWERED') DESC,
                calldate ASC
            LIMIT 1`;

        const [bestRecordRows] = await dbConnection.execute(bestRecordSql, [linkedId]);
        
        if ((bestRecordRows as any[]).length > 0) {
            const bestRecord = (bestRecordRows as any[])[0];
            // We use the data from the best record, but keep the original operator's answered record data if available
            // to ensure we have the correct operator details.
             const finalRecord = {
                ...bestRecord, // Base with recording file
                ...primaryCall, // Overwrite with specific operator data
                recordingfile: bestRecord.recordingfile, // Ensure recording file is from the best record
            };
            return { success: true, data: mapRowToCall(finalRecord) };
        }
        
        // Fallback to primary call if no better record is found
        return { success: true, data: mapRowToCall(primaryCall) };

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
        
        const baseQuery = `
            SELECT linkedid
            FROM cdr
            ${whereSql}
            GROUP BY linkedid
            HAVING SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) = 0
        `;

        const countSql = `SELECT COUNT(*) as total FROM (${baseQuery}) as subquery`;
        const [countRows] = await dbConnection.execute(countSql, sqlParams);
        const total = (countRows as any)[0].total;
        
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
        
        const finalParams = [...sqlParams, ...sqlParams];

        if (params.limit && params.page) {
            sql += ` LIMIT ? OFFSET ?`;
            finalParams.push(params.limit, (params.page - 1) * params.limit);
        }
        
        const [rows] = await dbConnection.execute(sql, finalParams);
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

    