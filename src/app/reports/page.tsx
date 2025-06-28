import { CallHistoryTable } from '@/components/reports/call-history-table';
import { mockCalls } from '@/lib/mock-data';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Call Reports</h1>
      <CallHistoryTable calls={mockCalls} />
    </div>
  );
}
