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
import type { Call } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

type EnrichedCall = Call & {
    callerName?: string;
    appealDescription?: string;
}

interface MyCallsTableProps {
    calls: EnrichedCall[];
    isLoading: boolean;
    onRowClick: (call: Call) => void;
}

export function MyCallsTable({ calls, isLoading, onRowClick }: MyCallsTableProps) {
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'dd.MM.yyyy HH:mm:ss', { locale: ru }) : 'Неверная дата';
  };

  const formatDuration = (seconds: number | undefined) => {
    if (seconds === undefined) return 'Н/Д';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const TableSkeleton = () => (
     <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Номер</TableHead>
          <TableHead>ФИО</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Дата и время</TableHead>
          <TableHead className="text-right">Разговор</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
            <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="rounded-md border">
      {isLoading ? <TableSkeleton /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Номер</TableHead>
              <TableHead>ФИО</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Дата и время</TableHead>
              <TableHead className="text-right">Разговор</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.length > 0 ? (
              calls.map((call) => (
                <TableRow key={call.id + call.startTime} onClick={() => onRowClick(call)} className="cursor-pointer">
                    <TableCell className="font-medium">{call.callerNumber}</TableCell>
                    <TableCell>{call.callerName || <span className="text-muted-foreground">Неизвестно</span>}</TableCell>
                    <TableCell>
                      <Badge
                        variant={call.status === 'ANSWERED' ? 'success' : 'destructive'}
                        className="capitalize"
                      >
                        {call.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(call.startTime)}</TableCell>
                    <TableCell className="text-right">{formatDuration(call.billsec)}</TableCell>
                  </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Звонки за выбранный период не найдены.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
