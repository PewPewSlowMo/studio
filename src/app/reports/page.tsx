import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3, Database } from 'lucide-react';
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
            <CardTitle>Call History Not Available</CardTitle>
            <CardDescription>
              Historical call data requires a database connection.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          To enable detailed call reporting and analytics, the application needs to be connected to a database (like PostgreSQL or MongoDB) to store Call Detail Records (CDRs).
        </p>
        <p className="mt-4 text-muted-foreground">
          The table below is currently empty because no data source is configured.
        </p>
      </CardContent>
    </Card>

      <CallHistoryTable calls={[]} />
    </div>
  );
}
