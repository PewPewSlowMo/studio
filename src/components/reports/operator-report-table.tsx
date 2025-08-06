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
import type { OperatorReportData } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface OperatorReportTableProps {
    data: OperatorReportData[];
    isLoading: boolean;
    onOperatorClick: (operatorId: string) => void;
    selectedOperatorId: string | null;
}

type SortKey = keyof OperatorReportData;

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '–';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'HH:mm:ss', { locale: ru }) : '–';
};

const TableSkeleton = () => (
    <Table>
        <TableHeader>
            <TableRow>
                <TableHead>Оператор</TableHead>
                <TableHead>Время работы</TableHead>
                <TableHead>Принято</TableHead>
                <TableHead>Исходящие</TableHead>
                <TableHead>Пропущено (%)</TableHead>
                <TableHead>Ср. разговор</TableHead>
                <TableHead>Ср. ожидание</TableHead>
                <TableHead>Оценка</TableHead>
                <TableHead>Переводы</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
);


export function OperatorReportTable({ data, isLoading, onOperatorClick, selectedOperatorId }: OperatorReportTableProps) {
    const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'ascending' | 'descending' }>({ key: 'operatorName', direction: 'ascending' });

    const sortedData = React.useMemo(() => {
        let sortableData = [...data];
        if (sortConfig !== null) {
            sortableData.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableData;
    }, [data, sortConfig]);

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

    const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey; children: React.ReactNode; className?: string }) => (
        <TableHead className={className}>
            <Button variant="ghost" onClick={() => requestSort(sortKey)} className="px-2 py-1 h-auto -ml-2 group">
                {children}
                {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    );

    if (isLoading) {
        return <div className="rounded-md border"><TableSkeleton /></div>;
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <SortableHeader sortKey="operatorName">Оператор</SortableHeader>
                        <SortableHeader sortKey="firstCallTime">Время работы</SortableHeader>
                        <SortableHeader sortKey="answeredIncomingCount">Принято</SortableHeader>
                        <SortableHeader sortKey="outgoingCount">Исходящие</SortableHeader>
                        <SortableHeader sortKey="missedCallsPercentage">Пропущено</SortableHeader>
                        <SortableHeader sortKey="avgTalkTime">Ср. разговор</SortableHeader>
                        <SortableHeader sortKey="avgWaitTime">Ср. ожидание</SortableHeader>
                        <SortableHeader sortKey="satisfactionScore">Оценка</SortableHeader>
                        <SortableHeader sortKey="transferredToSupervisorCount">Переводы</SortableHeader>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedData.length > 0 ? (
                        sortedData.map((op) => (
                            <TableRow 
                                key={op.operatorId}
                                onClick={() => onOperatorClick(op.operatorId)}
                                className={cn("cursor-pointer", selectedOperatorId === op.operatorId && "bg-muted hover:bg-muted/90")}
                            >
                                <TableCell className="font-medium">{op.operatorName}</TableCell>
                                <TableCell>{formatDateTime(op.firstCallTime)} - {formatDateTime(op.lastCallTime)}</TableCell>
                                <TableCell>
                                    {op.answeredIncomingCount}
                                </TableCell>
                                <TableCell>{op.outgoingCount}</TableCell>
                                <TableCell>
                                    <Badge variant={op.missedCallsPercentage > 10 ? 'destructive' : 'secondary'}>
                                        {op.missedCallsPercentage.toFixed(1)}% ({op.missedCallsCount})
                                    </Badge>
                                </TableCell>
                                <TableCell>{formatTime(op.avgTalkTime)}</TableCell>
                                <TableCell>{formatTime(op.avgWaitTime)}</TableCell>
                                <TableCell>{op.satisfactionScore}</TableCell>
                                <TableCell>{op.transferredToSupervisorCount}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={9} className="h-24 text-center">
                                Нет данных для отображения за выбранный период.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
