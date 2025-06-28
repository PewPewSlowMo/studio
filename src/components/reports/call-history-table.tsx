'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import type { Call } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';

export function CallHistoryTable({ calls }: { calls: Call[] }) {
  const [filter, setFilter] = React.useState('');
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const filteredCalls = React.useMemo(() => {
    if (!filter) return calls;
    return calls.filter(
      (call) =>
        call.callerNumber.includes(filter) ||
        (call.operatorName &&
          call.operatorName.toLowerCase().includes(filter.toLowerCase()))
    );
  }, [calls, filter]);

  const formatDate = (dateString: string) => {
    // On the server or before the component has mounted on the client,
    // return a placeholder to avoid hydration mismatch due to timezones.
    if (!isClient) {
      return '...';
    }
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'Pp') : 'Invalid Date';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Input
          placeholder="Filter by number or operator..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Caller</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>Talk Time (s)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCalls.length > 0 ? (
              filteredCalls.map((call) => (
                <TableRow key={call.id + call.startTime}>
                  <TableCell className="font-medium">{call.callerNumber}</TableCell>
                  <TableCell>{call.operatorName || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        call.status.toLowerCase() !== 'answered' ? 'destructive' : 'secondary'
                      }
                      className="capitalize"
                    >
                      {call.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDate(call.startTime)}
                  </TableCell>
                  <TableCell>{call.billsec ?? 'N/A'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No call history data found for the selected period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
