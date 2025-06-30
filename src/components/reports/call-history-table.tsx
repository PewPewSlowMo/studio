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
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

export function CallHistoryTable({ calls, isLoading, onRowClick }: { calls: Call[], isLoading: boolean, onRowClick?: (call: Call) => void }) {
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
    if (!isClient) {
      return '...';
    }
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'Pp') : 'Invalid Date';
  };
  
  const TableSkeleton = () => (
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
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

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
        {isLoading ? <TableSkeleton /> : (
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
                    <TableRow 
                      key={call.id + call.startTime}
                      onClick={() => onRowClick?.(call)}
                      className={cn(onRowClick && 'cursor-pointer')}
                    >
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
        )}
      </div>
    </div>
  );
}
