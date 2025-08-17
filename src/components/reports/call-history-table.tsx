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
import type { Call, User } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { ru } from 'date-fns/locale';
import { ArrowDown, ArrowUp, Phone, PhoneForwarded } from 'lucide-react';
import { Button } from '../ui/button';
import { CallRowDetails } from './call-row-details';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '../ui/pagination';
import { CallHistoryPlaceholder } from './call-history-placeholder';

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

export function CallHistoryTable({ 
    calls, 
    isLoading, 
    page, 
    limit, 
    total, 
    onPageChange,
    callType
}: { 
    calls: EnrichedOperatorCall[], 
    isLoading: boolean, 
    page: number,
    limit: number,
    total: number,
    onPageChange: (page: number) => void;
    callType: 'answered' | 'outgoing' | 'missed';
}) {
  const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'startTime', direction: 'descending' });
  const [activeRowId, setActiveRowId] = React.useState<string | null>(null);

  const handleRowClick = (callId: string) => {
    setActiveRowId(prevId => (prevId === callId ? null : callId));
  };
  
  const sortedCalls = React.useMemo(() => {
    let sortableData = [...calls];
    if (sortConfig !== null) {
      sortableData.sort((a, b) => {
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
    return sortableData;
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
  
  if (isLoading) {
    return <CallHistoryPlaceholder />
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader sortKey={callType === 'outgoing' ? 'calledNumber' : 'callerNumber'}>
                    <div className='flex items-center gap-2'>
                        {callType === 'outgoing' ? <PhoneForwarded/> : <Phone/>}
                        <span>{callType === 'outgoing' ? 'Кому звонил' : 'Кто звонил'}</span>
                    </div>
                  </SortableHeader>
                  <SortableHeader sortKey="startTime">Время</SortableHeader>
                  <SortableHeader sortKey="status">Статус</SortableHeader>
                  <SortableHeader sortKey="queueName">Очередь</SortableHeader>
                  <SortableHeader sortKey="billsec" className="text-right">Разговор (сек)</SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCalls.length > 0 ? (
                  sortedCalls.map((call) => (
                    <React.Fragment key={`${call.id}-${call.startTime}`}>
                        <TableRow 
                            onClick={() => handleRowClick(call.id)}
                            className="cursor-pointer hover:bg-muted"
                        >
                            <TableCell className="font-medium">{callType === 'outgoing' ? call.calledNumber : call.callerNumber}</TableCell>
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
                            <TableCell className="text-right">{call.billsec ?? '-'}</TableCell>
                        </TableRow>
                        {activeRowId === call.id && (
                            <TableRow>
                                <TableCell colSpan={7} className="p-0">
                                    <CallRowDetails call={call} user={null} isCrmEditable={false} />
                                </TableCell>
                            </TableRow>
                        )}
                    </React.Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Нет звонков этого типа за выбранный период.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
    </div>
  );
}
