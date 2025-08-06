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
import type { Call, User } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { ru } from 'date-fns/locale';
import { ArrowDown, ArrowUp, Star } from 'lucide-react';
import { Button } from '../ui/button';
import { CallRowDetails } from './call-row-details';

export type EnrichedOperatorCall = Call & {
    operatorName?: string;
    queueName?: string;
    resolution?: string;
};

const statusMap: Record<string, string> = {
    ANSWERED: 'Отвечен',
    'NO ANSWER': 'Пропущен',
    BUSY: 'Занято',
    FAILED: 'Ошибка',
};

type SortKey = keyof EnrichedOperatorCall;

export function CallHistoryTable({ calls, isLoading, user }: { calls: EnrichedOperatorCall[], isLoading: boolean, user: User | null }) {
  const [filter, setFilter] = React.useState('');
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'startTime', direction: 'descending' });
  const [activeRowId, setActiveRowId] = React.useState<string | null>(null);

  const handleRowClick = (callId: string) => {
    setActiveRowId(prevId => (prevId === callId ? null : callId));
  };
  
  const filteredAndSortedCalls = React.useMemo(() => {
    let filtered = calls;
    if (filter) {
        filtered = calls.filter(
          (call) =>
            call.callerNumber.includes(filter)
        );
    }
    
    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        
        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        } else {
             comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }

    return filtered;

  }, [calls, filter, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
        return <div className="w-4 h-4 opacity-0 group-hover:opacity-50" />;
    }
    return sortConfig.direction === 'ascending' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => (
    <TableHead className={className}>
        <Button variant="ghost" onClick={() => requestSort(sortKey)} className="px-2 py-1 h-auto -ml-2 group">
            {children}
            {getSortIcon(sortKey)}
        </Button>
    </TableHead>
  );


  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'Pp', { locale: ru }) : 'Неверная дата';
  };
  
  const TableSkeleton = () => (
     <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Звонящий</TableHead>
          <TableHead>Время</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Очередь</TableHead>
          <TableHead>Результат</TableHead>
          <TableHead>Оценка</TableHead>
          <TableHead>Разговор</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
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
          placeholder="Фильтр по номеру..."
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
                  <SortableHeader sortKey="callerNumber">Звонящий</SortableHeader>
                  <SortableHeader sortKey="startTime">Время</SortableHeader>
                  <SortableHeader sortKey="status">Статус</SortableHeader>
                  <SortableHeader sortKey="queueName">Очередь</SortableHeader>
                  <SortableHeader sortKey="resolution">Результат</SortableHeader>
                  <SortableHeader sortKey="satisfaction">Оценка</SortableHeader>
                  <SortableHeader sortKey="billsec" className="text-right">Разговор (сек)</SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedCalls.length > 0 ? (
                  filteredAndSortedCalls.map((call) => (
                    <React.Fragment key={call.id}>
                        <TableRow 
                            onClick={() => handleRowClick(call.id)}
                            className="cursor-pointer hover:bg-muted"
                        >
                            <TableCell className="font-medium">{call.callerNumber}</TableCell>
                             <TableCell>
                                {formatDate(call.startTime)}
                            </TableCell>
                            <TableCell>
                                <Badge
                                variant={
                                    call.status !== 'ANSWERED' ? 'destructive' : 'success'
                                }
                                >
                                {statusMap[call.status] || call.status}
                                </Badge>
                            </TableCell>
                           <TableCell>{call.queueName}</TableCell>
                            <TableCell className="capitalize">{call.resolution}</TableCell>
                            <TableCell>
                                {call.satisfaction ? (
                                    <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                                    <span>{call.satisfaction}</span>
                                    </div>
                                ) : (
                                    <span>-</span>
                                )}
                            </TableCell>
                            <TableCell className="text-right">{call.billsec ?? '-'}</TableCell>
                        </TableRow>
                        {activeRowId === call.id && (
                            <TableRow>
                                <TableCell colSpan={7} className="p-0">
                                    <CallRowDetails call={call} user={user} isCrmEditable={false} />
                                </TableCell>
                            </TableRow>
                        )}
                    </React.Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Нет данных о звонках за выбранный период.
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
