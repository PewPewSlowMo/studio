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
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '../ui/button';
import { CallRowDetails } from './call-row-details';

const statusMap: Record<string, string> = {
    ANSWERED: 'Отвечен',
    'NO ANSWER': 'Без ответа',
    BUSY: 'Занято',
    FAILED: 'Ошибка',
};

type SortKey = keyof Call;

export function CallHistoryTable({ calls, isLoading, user }: { calls: Call[], isLoading: boolean, user: User | null }) {
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
            call.callerNumber.includes(filter) ||
            (call.operatorName &&
              call.operatorName.toLowerCase().includes(filter.toLowerCase()))
        );
    }
    
    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
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
          <TableHead>Оператор</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Время начала</TableHead>
          <TableHead>Разговор (сек)</TableHead>
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
          placeholder="Фильтр по номеру или оператору..."
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
                  <SortableHeader sortKey="operatorName">Оператор</SortableHeader>
                  <SortableHeader sortKey="status">Статус</SortableHeader>
                  <SortableHeader sortKey="startTime">Время начала</SortableHeader>
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
                            <TableCell>{call.operatorName || 'N/A'}</TableCell>
                            <TableCell>
                                <Badge
                                variant={
                                    call.status !== 'ANSWERED' ? 'destructive' : 'success'
                                }
                                >
                                {statusMap[call.status] || call.status}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                {formatDate(call.startTime)}
                            </TableCell>
                            <TableCell className="text-right">{call.billsec ?? 'N/A'}</TableCell>
                        </TableRow>
                        {activeRowId === call.id && (
                            <TableRow>
                                <TableCell colSpan={5} className="p-0">
                                    <CallRowDetails call={call} user={user} isCrmEditable={false} />
                                </TableCell>
                            </TableRow>
                        )}
                    </React.Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
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
