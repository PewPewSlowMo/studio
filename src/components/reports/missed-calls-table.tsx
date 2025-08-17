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
import { Badge } from '@/components/ui/badge';
import type { Call } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { PhoneMissed, Calendar } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '../ui/pagination';

function formatTime(seconds: number | undefined) {
    if (seconds === undefined || seconds === null) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

const reasonVariantMap: Record<string, 'destructive' | 'secondary' | 'default'> = {
    'Превышено время ожидания': 'destructive',
    'Все операторы заняты': 'destructive',
    'Техническая проблема': 'secondary',
    'Системная ошибка': 'default',
};

interface MissedCallsTableProps {
    calls: Call[];
    isLoading: boolean;
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
}

export function MissedCallsTable({ calls, isLoading, page, limit, total, onPageChange }: MissedCallsTableProps) {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const formatDate = (dateString: string) => {
    if (!isClient) {
      return '...';
    }
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'dd.MM.yyyy, HH:mm:ss') : 'Invalid Date';
  };
  
  const TableSkeleton = () => (
    <Table>
      <TableHeader>
        <TableRow>
            <TableHead>Номер телефона</TableHead>
            <TableHead>Очередь</TableHead>
            <TableHead>Дата и время</TableHead>
            <TableHead className="text-center">Время ожидания</TableHead>
            <TableHead>Причина</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(10)].map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
            <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-36" /></TableCell>
            <TableCell><Skeleton className="h-6 w-16 mx-auto rounded" /></TableCell>
            <TableCell><Skeleton className="h-6 w-40 rounded-full" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <>
        <div className="rounded-md border">
            {isLoading ? <TableSkeleton /> : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Номер телефона</TableHead>
                            <TableHead>Очередь</TableHead>
                            <TableHead>Дата и время</TableHead>
                            <TableHead className="text-center">Время ожидания</TableHead>
                            <TableHead>Причина</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {calls.length > 0 ? (
                            calls.map((call) => (
                                <TableRow key={call.id + call.startTime}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2 text-destructive">
                                            <PhoneMissed className="h-4 w-4" />
                                            <span>{call.callerNumber}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{call.queue || '-'}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="h-4 w-4" />
                                            <span>{formatDate(call.startTime)}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className={cn(
                                            'font-mono p-1 rounded text-center w-16 mx-auto', 
                                            (call.waitTime || 0) > 180 ? 'bg-destructive text-destructive-foreground' : ''
                                        )}>
                                            {formatTime(call.waitTime)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={reasonVariantMap[call.reason!] || 'default'}>
                                            {call.reason}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    Пропущенные звонки за выбранный период не найдены.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            )}
        </div>
         {total > limit && (
            <div className="flex items-center justify-between space-x-2 py-4">
                 <div className="text-sm text-muted-foreground">
                    Страница {page} из {totalPages}
                </div>
                <Pagination>
                    <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious onClick={() => onPageChange(page - 1)} className={cn(page <= 1 && "pointer-events-none opacity-50")} />
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationNext onClick={() => onPageChange(page + 1)} className={cn(page >= totalPages && "pointer-events-none opacity-50")} />
                    </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </div>
        )}
    </>
  );
}
