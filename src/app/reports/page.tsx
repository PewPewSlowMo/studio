import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Database } from 'lucide-react';
import { CallHistoryTable } from '@/components/reports/call-history-table';

export default function ReportsPage() {
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
                Historical call data requires a database connection to be configured in the admin panel.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
           <CallHistoryTable calls={[]} />
        </CardContent>
      </Card>
    </div>
  );
}
