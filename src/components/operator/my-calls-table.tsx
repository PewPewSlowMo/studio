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
import type { User, Appeal } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { ArrowUp, ArrowDown, FileText, PhoneOutgoing, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { EnrichedCall } from '@/app/my-calls/page';
import { CallRowDetails } from '../reports/call-row-details';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from '../ui/pagination';

interface MyCallsTableProps {
    calls: EnrichedCall[];
    isLoading: boolean;
    user: User | null;
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
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

export function MyCallsTable({ calls, isLoading, user, page, limit, total, onPageChange }: MyCallsTableProps) {
    const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'startTime', direction: 'descending' });
    const [activeRowId, setActiveRowId] = React.useState<string | null>(null);

    const handleRowClick = (callId: string) => {
        setActiveRowId(prevId => (prevId === callId ? null : callId));
    };

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
            return <div className="w-4 h-4" />;
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
    if (seconds === undefined || seconds === null) return '-';
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
          <TableHead>Оценка</TableHead>
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
            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
            <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <>
        <TooltipProvider>
        <div className="rounded-md border">
        {isLoading ? <TableSkeleton /> : (
            <Table>
            <TableHeader>
                <TableRow>
                    <SortableHeader sortKey="callerNumber">Номер</SortableHeader>
                    <SortableHeader sortKey="callerName">ФИО</SortableHeader>
                    <SortableHeader sortKey="category">Категория</SortableHeader>
                    <SortableHeader sortKey="status">Статус</SortableHeader>
                    <SortableHeader sortKey="satisfaction">Оценка</SortableHeader>
                    <SortableHeader sortKey="startTime">Дата и время</SortableHeader>
                    <SortableHeader sortKey="billsec" className="text-right">Разговор</SortableHeader>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedCalls.length > 0 ? (
                sortedCalls.map((call, index) => (
                    <React.Fragment key={`${call.id}-${call.startTime}-${index}`}>
                        <TableRow onClick={() => handleRowClick(call.id)} className="cursor-pointer">
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <FileText className={cn('h-4 w-4 shrink-0', call.cardFilled ? 'text-green-500' : 'text-red-500')} />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{call.cardFilled ? 'Карточка заполнена' : 'Карточка не заполнена'}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    {call.followUp && (
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <PhoneOutgoing className={cn('h-4 w-4 shrink-0', call.followUpCompleted ? 'text-green-500' : 'text-yellow-500')} />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{call.followUpCompleted ? 'Перезвон выполнен' : 'Требуется перезвон'}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                <span>{call.callerNumber}</span>
                                </div>
                            </TableCell>
                            <TableCell>{call.callerName || <span className="text-muted-foreground">-</span>}</TableCell>
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
                            <TableCell>
                                {call.satisfaction ? (
                                    <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                                    <span>{call.satisfaction}</span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell>{formatDate(call.startTime)}</TableCell>
                            <TableCell className="text-right">{formatDuration(call.billsec)}</TableCell>
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
                    Звонки за выбранный период не найдены.
                    </TableCell>
                </TableRow>
                )}
            </TableBody>
            </Table>
        )}
        </div>
        </TooltipProvider>
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
