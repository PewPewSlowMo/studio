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
import type { User } from '@/lib/types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import { ArrowDown, ArrowUp, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Star } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import type { ActiveDetails } from '@/app/reports/page';

export interface OperatorReportData {
    operatorId: string;
    operatorExtension: string;
    operatorName: string;
    answeredCount: number;
    outgoingCount: number;
    missedCount: number;
    avgTalkTime: number;
    avgSatisfaction: number;
}

interface OperatorReportTableProps {
    data: OperatorReportData[];
    isLoading: boolean;
    onStatClick: (operatorExtension: string, callType: 'answered' | 'outgoing' | 'missed') => void;
    activeDetails: ActiveDetails;
}

type SortKey = keyof OperatorReportData;

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const TableSkeleton = () => (
    <Table>
        <TableHeader>
            <TableRow>
                <TableHead>Оператор</TableHead>
                <TableHead className="text-center">Принято</TableHead>
                <TableHead className="text-center">Исходящие</TableHead>
                <TableHead className="text-center">Пропущено</TableHead>
                <TableHead className="text-center">Ср. время разговора</TableHead>
                <TableHead className="text-center">Ср. оценка</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
);

const StatCell = ({ 
    count, 
    operatorExtension, 
    type, 
    onStatClick,
    isActive,
    icon: Icon,
    className
}: { 
    count: number, 
    operatorExtension: string, 
    type: 'answered' | 'outgoing' | 'missed', 
    onStatClick: Function,
    isActive: boolean,
    icon: React.ElementType,
    className?: string
}) => {
    if (count === 0) {
        return <span className="text-muted-foreground">-</span>;
    }
    return (
        <Button 
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            className={cn("font-semibold", className)}
            onClick={(e) => {
                e.stopPropagation();
                onStatClick(operatorExtension, type);
            }}
        >
            <Icon className="mr-2 h-4 w-4"/>
            {count}
        </Button>
    )
};

export function OperatorReportTable({ data, isLoading, onStatClick, activeDetails }: OperatorReportTableProps) {
    const [sortConfig, setSortConfig] = React.useState<{ key: SortKey; direction: 'ascending' | 'descending' }>({ key: 'answeredCount', direction: 'descending' });

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
                        <SortableHeader sortKey="answeredCount" className="text-center">Принято</SortableHeader>
                        <SortableHeader sortKey="outgoingCount" className="text-center">Исходящие</SortableHeader>
                        <SortableHeader sortKey="missedCount" className="text-center">Пропущено</SortableHeader>
                        <SortableHeader sortKey="avgTalkTime" className="text-center">Ср. время разговора</SortableHeader>
                        <SortableHeader sortKey="avgSatisfaction" className="text-center">Ср. оценка</SortableHeader>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedData.length > 0 ? (
                        sortedData.map((op) => (
                            <TableRow 
                                key={op.operatorId}
                                className="cursor-pointer"
                            >
                                <TableCell className="font-medium">{op.operatorName}</TableCell>
                                <TableCell className="text-center">
                                    <StatCell 
                                        count={op.answeredCount} 
                                        operatorExtension={op.operatorExtension} 
                                        type="answered"
                                        onStatClick={onStatClick}
                                        isActive={activeDetails?.operatorExtension === op.operatorExtension && activeDetails?.callType === 'answered'}
                                        icon={PhoneIncoming}
                                        className='text-green-600 hover:text-green-700'
                                    />
                                </TableCell>
                                <TableCell className="text-center">
                                     <StatCell 
                                        count={op.outgoingCount} 
                                        operatorExtension={op.operatorExtension} 
                                        type="outgoing"
                                        onStatClick={onStatClick}
                                        isActive={activeDetails?.operatorExtension === op.operatorExtension && activeDetails?.callType === 'outgoing'}
                                        icon={PhoneOutgoing}
                                        className='text-blue-600 hover:text-blue-700'
                                    />
                                </TableCell>
                                <TableCell className="text-center">
                                     <StatCell 
                                        count={op.missedCount} 
                                        operatorExtension={op.operatorExtension} 
                                        type="missed"
                                        onStatClick={onStatClick}
                                        isActive={activeDetails?.operatorExtension === op.operatorExtension && activeDetails?.callType === 'missed'}
                                        icon={PhoneMissed}
                                        className='text-red-600 hover:text-red-700'
                                    />
                                </TableCell>
                                <TableCell className="text-center font-mono">{formatTime(op.avgTalkTime)}</TableCell>
                                <TableCell className="text-center">
                                    {op.avgSatisfaction > 0 ? (
                                        <div className="flex items-center justify-center gap-1 font-semibold">
                                            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400"/>
                                            {op.avgSatisfaction.toFixed(2)}
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                Нет данных для отображения за выбранный период.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
