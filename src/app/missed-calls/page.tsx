'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, PhoneOff, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getMissedCalls, type DateRangeParams } from '@/actions/cdr';
import { getConfig } from '@/actions/config';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MissedCallsTable } from '@/components/reports/missed-calls-table';
import { MissedCallKpiCard } from '@/components/reports/missed-kpi-card';
import type { Call } from '@/lib/types';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays, format, parseISO, isValid } from 'date-fns';

function getMissedReason(call: Call): string {
    if (call.status === 'BUSY') return 'Все операторы заняты';
    if (call.status === 'NO ANSWER' && (call.waitTime || 0) > 180) return 'Превышено время ожидания'; // Example: > 3 minutes
    if (call.status === 'FAILED') return 'Техническая проблема';
    return 'Системная ошибка';
}

function KpiCardSkeleton() {
    return (
        <Card>
            <CardContent className="p-4 flex items-center gap-4">
                <Skeleton className="h-8 w-8" />
                <div>
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-7 w-20" />
                </div>
            </CardContent>
        </Card>
    );
}

export default function MissedCallsPage() {
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [calls, setCalls] = useState<Call[]>([]);
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const toParam = searchParams.get('to');
                const fromParam = searchParams.get('from');

                const to = toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : new Date();
                const from = fromParam && isValid(parseISO(fromParam)) ? parseISO(fromParam) : subDays(to, 0); // Default to today
                const dateRange: DateRangeParams = { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };

                const config = await getConfig();
                const missedCallsResult = await getMissedCalls(config.cdr, dateRange);

                if (!missedCallsResult.success) {
                    throw new Error(missedCallsResult.error || 'Failed to fetch missed calls');
                }
                setCalls(missedCallsResult.data || []);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'An unknown error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [searchParams]);

    const analyticsData = useMemo(() => {
        const callsWithReason = calls.map(call => ({
            ...call,
            reason: getMissedReason(call)
        }));

        const totalMissed = calls.length;
        const totalWaitTime = calls.reduce((acc, call) => acc + (call.waitTime || 0), 0);
        const averageWaitTime = totalMissed > 0 ? totalWaitTime / totalMissed : 0;
        const maxWaitTime = Math.max(0, ...calls.map(call => call.waitTime || 0));

        const reasonCounts = callsWithReason.reduce((acc, call) => {
            acc[call.reason!] = (acc[call.reason!] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const mainReason = Object.keys(reasonCounts).length > 0
            ? Object.entries(reasonCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0]
            : 'N/A';
        
        return { callsWithReason, totalMissed, averageWaitTime, maxWaitTime, mainReason };
    }, [calls]);
    
    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Could not load missed calls</AlertTitle>
                <AlertDescription>
                    <p>There was an error connecting to the Call Detail Record database. Please check your connection settings in the Admin page.</p>
                    <p className="mt-2 font-mono text-xs">Error: {error}</p>
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-destructive-foreground">Пропущенные звонки</h1>
                    <p className="text-muted-foreground">Анализ пропущенных звонков и их причин</p>
                </div>
                <div className="flex items-center gap-2">
                    <DateRangePicker />
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" /> CSV
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <MissedCallKpiCard icon={PhoneOff} title="Пропущенные звонки" value={analyticsData.totalMissed.toString()} />
                    <MissedCallKpiCard icon={Clock} title="Среднее время ожидания" value={formatTime(analyticsData.averageWaitTime)} />
                    <MissedCallKpiCard icon={AlertTriangle} title="Максимальное ожидание" value={formatTime(analyticsData.maxWaitTime)} />
                    <MissedCallKpiCard icon={TrendingUp} title="Основная причина" value={analyticsData.mainReason} />
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Детальный список пропущенных звонков</CardTitle>
                    <CardDescription>
                        {isLoading ? 'Загрузка...' : `Показано ${analyticsData.callsWithReason.length} из ${analyticsData.callsWithReason.length} пропущенных звонков`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <MissedCallsTable calls={analyticsData.callsWithReason} isLoading={isLoading} />
                </CardContent>
            </Card>
        </div>
    );
}