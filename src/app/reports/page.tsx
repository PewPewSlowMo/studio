import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Database, AlertTriangle } from 'lucide-react';
import { CallHistoryTable } from '@/components/reports/call-history-table';
import { getCallHistory, type DateRangeParams } from '@/actions/cdr';
import { getUsers } from '@/actions/users';
import { getConfig } from '@/actions/config';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Call } from '@/lib/types';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { subDays, format } from 'date-fns';

export default async function ReportsPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const config = await getConfig();

    const to = searchParams?.to ? new Date(searchParams.to as string) : new Date();
    const from = searchParams?.from ? new Date(searchParams.from as string) : subDays(to, 6);
    const dateRange: DateRangeParams = { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };

    // Fetch calls and users in parallel
    const [callsResult, users] = await Promise.all([
        getCallHistory(config.cdr, dateRange),
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold">Call History Reports</h1>
            <p className="text-muted-foreground">A log of all calls from the selected period.</p>
        </div>
        <DateRangePicker />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Database className="h-8 w-8 text-muted-foreground" />
            <div>
              <CardTitle>Call History</CardTitle>
              <CardDescription>
                A log of calls from the selected time period.
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
