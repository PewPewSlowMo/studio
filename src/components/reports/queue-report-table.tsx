'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { QueueReportData } from '@/lib/types';
import { BarChart, Clock, Phone, PhoneMissed, Percent, ShieldCheck } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

interface QueueReportTableProps {
  data: QueueReportData[];
  isLoading: boolean;
}

const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}м ${secs.toString().padStart(2, '0')}с`;
};

export function QueueReportTable({ data, isLoading }: QueueReportTableProps) {
  
  const TableSkeleton = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Очередь</TableHead>
          <TableHead className="text-center">Всего звонков</TableHead>
          <TableHead className="text-center">Отвечено</TableHead>
          <TableHead className="text-center">Потеряно</TableHead>
          <TableHead className="text-center">Уровень потерянных</TableHead>
          <TableHead className="text-center">SLA (%)</TableHead>
          <TableHead className="text-center">Ср. время ожидания</TableHead>
          <TableHead className="text-center">Ср. время обработки</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(3)].map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
            <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
            <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
            <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
            <TableCell className="text-center"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
            <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <TableSkeleton />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground rounded-md border">
        Нет данных для отображения.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Очередь</TableHead>
            <TableHead className="text-center">Всего звонков</TableHead>
            <TableHead className="text-center">Отвечено</TableHead>
            <TableHead className="text-center">Потеряно</TableHead>
            <TableHead className="text-center">Уровень потерянных</TableHead>
            <TableHead className="text-center">SLA (%)</TableHead>
            <TableHead className="text-center">Ср. время ожидания</TableHead>
            <TableHead className="text-center">Ср. время обработки</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((queue) => (
            <TableRow key={queue.queueName}>
              <TableCell className="font-medium">{queue.queueName}</TableCell>
              <TableCell className="text-center">{queue.totalCalls}</TableCell>
              <TableCell className="text-center text-green-600 font-medium">{queue.answeredCalls}</TableCell>
              <TableCell className="text-center text-red-600 font-medium">{queue.missedCalls}</TableCell>
              <TableCell className="text-center">{queue.abandonmentRate.toFixed(1)}%</TableCell>
              <TableCell className="text-center">
                 <Badge variant={queue.sla >= 80 ? 'success' : 'destructive'}>
                    {queue.sla.toFixed(1)}%
                </Badge>
              </TableCell>
              <TableCell className="text-center">{formatTime(queue.avgWaitTime)}</TableCell>
              <TableCell className="text-center">{formatTime(queue.avgHandleTime)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}