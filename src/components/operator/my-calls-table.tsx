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
import type { Call, Appeal } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { ArrowUp, ArrowDown, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type EnrichedCall = Call & {
    callerName?: string;
    cardFilled?: boolean;
    category?: Appeal['category'];
};

interface MyCallsTableProps {
    calls: EnrichedCall[];
    isLoading: boolean;
    onRowClick: (call: Call) => void;
}

type SortKey = keyof EnrichedCall;

const categoryMap: Record<string, string> = {
    sales: 'Продажи',
    complaint: 'Жалоба',
    support: 'Техподдержка',
    info: 'Информация',
    other: 'Другое',
};

const statusMap: Record<string, string> = {
    ANSWERED: 'Отвечен',
    'NO ANSWER': 'Без ответа',
    BUSY: 'Занято',
    FAILED: 'Ошибка',
};


export function MyCallsTable({ calls, isLoading, onRowClick }: MyCallsTableProps) {
    const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'startTime', direction: 'descending' });

    const sortedCalls = React.useMemo(() => {
        let sortableCalls = [...calls];
        if (sortConfig !== null) {
            sortableCalls.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === undefined || aValue === null) return 1;
                if (bValue === undefined || bValue === null) return -1;
                
                let comparison = 0;
                if (sortConfig.key === 'startTime') {
                    comparison = new Date(aValue as string).getTime() - new Date(bValue as string).getTime();
                } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                    comparison = aValue.localeCompare(bValue);
                } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                     comparison = aValue - bValue;
                } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
                    comparison = aValue === bValue ? 0 : aValue ? -1 : 1;
                } else {
                    comparison = String(aValue).localeCompare(String(bValue));
                }

                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        return sortableCalls;
    }, [calls, sortConfig]);

    const requestSort = (key: SortKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <div className="w-4 h-4 opacity-0" />;
        }
        return sortConfig.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
    };

    const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => (
        <TableHead className={className}>
            <Button variant="ghost" onClick={() => requestSort(sortKey)} className="px-2 py-1 h-auto -ml-2">
                {children}
                {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    );

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
          <TableHead>Категория</TableHead>
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
            <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
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
                <SortableHeader sortKey="callerNumber">Номер</SortableHeader>
                <SortableHeader sortKey="callerName">ФИО</SortableHeader>
                <SortableHeader sortKey="category">Категория</SortableHeader>
                <SortableHeader sortKey="status">Статус</SortableHeader>
                <SortableHeader sortKey="startTime">Дата и время</SortableHeader>
                <SortableHeader sortKey="billsec" className="text-right">Разговор</SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCalls.length > 0 ? (
              sortedCalls.map((call) => (
                <TableRow key={call.id + call.startTime} onClick={() => onRowClick(call)} className="cursor-pointer">
                    <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                           <FileText className={cn('h-4 w-4 shrink-0', call.cardFilled ? 'text-green-500' : 'text-red-500')} />
                           <span>{call.callerNumber}</span>
                        </div>
                    </TableCell>
                    <TableCell>{call.callerName || <span className="text-muted-foreground">Неизвестно</span>}</TableCell>
                    <TableCell>
                        {call.category ? (
                            <Badge variant="outline" className="capitalize">{categoryMap[call.category] || call.category}</Badge>
                        ) : (
                            <span className="text-muted-foreground">-</span>
                        )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={call.status === 'ANSWERED' ? 'success' : 'destructive'}
                      >
                        {statusMap[call.status] || call.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(call.startTime)}</TableCell>
                    <TableCell className="text-right">{formatDuration(call.billsec)}</TableCell>
                  </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
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
