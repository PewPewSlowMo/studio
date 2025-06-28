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
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { Call } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';

export function CallHistoryTable({ calls }: { calls: Call[] }) {
  const [filter, setFilter] = React.useState('');

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
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Caller</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>Duration (s)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCalls.length > 0 ? (
              filteredCalls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell className="font-medium">{call.callerNumber}</TableCell>
                  <TableCell>{call.operatorName || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        call.status === 'missed' ? 'destructive' : 'secondary'
                      }
                      className="capitalize"
                    >
                      {call.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDate(call.startTime)}
                  </TableCell>
                  <TableCell>{call.duration || 'N/A'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No call history data found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
