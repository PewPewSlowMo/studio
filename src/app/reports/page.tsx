import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Database, AlertTriangle } from 'lucide-react';
import { CallHistoryTable } from '@/components/reports/call-history-table';
import { getCallHistory } from '@/actions/cdr';
import { getUsers } from '@/actions/users';
import { getConfig } from '@/actions/config';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Call } from '@/lib/types';

export default async function ReportsPage() {
    const config = await getConfig();

    // Fetch calls and users in parallel
    const [callsResult, users] = await Promise.all([
        getCallHistory(config.cdr),
        getUsers(),
    ]);

    if (!callsResult.success) {
        return (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Could not connect to CDR Database</AlertTitle>
                <AlertDescription>
                    <p>There was an error connecting to the Call Detail Record database. Please check your connection settings in the Admin page.</p>
                    <p className="mt-2 font-mono text-xs">Error: {callsResult.error}</p>
                </AlertDescription>
            </Alert>
        )
    }

    const calls: Call[] = callsResult.data || [];
    
    // Create a map of extension -> user name for easy lookup
    const userMap = new Map(users.filter(u => u.extension).map(user => [user.extension, user.name]));

    // Enrich calls with operator name
    const enrichedCalls = calls.map(call => ({
        ...call,
        operatorName: call.operatorExtension 
            ? (userMap.get(call.operatorExtension) || `Ext. ${call.operatorExtension}`) 
            : 'N/A',
    }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Call Reports</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Database className="h-8 w-8 text-muted-foreground" />
            <div>
              <CardTitle>Call History</CardTitle>
              <CardDescription>
                A log of calls from the last 24 hours.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
           <CallHistoryTable calls={enrichedCalls} />
        </CardContent>
      </Card>
    </div>
  );
}
