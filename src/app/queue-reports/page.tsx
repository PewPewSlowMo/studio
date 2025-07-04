'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getConfig } from '@/actions/config';
import { getCallHistory, type DateRangeParams } from '@/actions/cdr';
import { getAmiQueues } from '@/actions/ami';
import type { AsteriskQueue, Call } from '@/lib/types';
import { QueueReportTable } from '@/components/reports/queue-report-table';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { subDays, format, parseISO, isValid } from 'date-fns';

const SLA_TARGET_SECONDS = 30;

export default function QueueReportsPage() {
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [queues, setQueues] = useState<AsteriskQueue[]>([]);
    const [calls, setCalls] = useState<Call[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const toParam = searchParams.get('to');
                const fromParam = searchParams.get('from');

                const to = toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : new Date();
                const from = fromParam && isValid(parseISO(fromParam)) ? parseISO(fromParam) : subDays(to, 6);
                const dateRange: DateRangeParams = { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };

                const config = await getConfig();
                const [queuesResult, callsResult] = await Promise.all([
                    getAmiQueues(config.ami),
                    getCallHistory(config.cdr, dateRange)
                ]);

                if (!queuesResult.success) throw new Error(queuesResult.error || 'Failed to fetch queues');
                if (!callsResult.success) throw new Error(callsResult.error || 'Failed to fetch call history');
                
                setQueues(queuesResult.data || []);
                setCalls(callsResult.data || []);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'An unknown error occurred');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [searchParams]);

    const queueReportData = useMemo(() => {
        if (!queues.length) return [];
        return queues.map(queue => {
            const queueCalls = calls.filter(c => c.queue === queue.name);
            const answeredCalls = queueCalls.filter(c => c.status === 'ANSWERED' && c.waitTime !== undefined && c.billsec !== undefined);
            const missedCalls = queueCalls.filter(c => c.status !== 'ANSWERED');

            const totalCalls = queueCalls.length;
            const totalAnswered = answeredCalls.length;

            const callsAnsweredWithinSla = answeredCalls.filter(c => c.waitTime! <= SLA_TARGET_SECONDS).length;
            const sla = totalAnswered > 0 ? (callsAnsweredWithinSla / totalAnswered) * 100 : 0;

            const totalWaitTime = answeredCalls.reduce((acc, c) => acc + c.waitTime!, 0);
            const avgWaitTime = totalAnswered > 0 ? totalWaitTime / totalAnswered : 0;

            const totalHandleTime = answeredCalls.reduce((acc, c) => acc + c.billsec!, 0);
            const avgHandleTime = totalAnswered > 0 ? totalHandleTime / totalAnswered : 0;

            const abandonmentRate = totalCalls > 0 ? (missedCalls.length / totalCalls) * 100 : 0;

            return {
                queueName: queue.name,
                totalCalls: totalCalls,
                answeredCalls: totalAnswered,
                missedCalls: missedCalls.length,
                abandonmentRate: abandonmentRate,
                sla: sla,
                avgWaitTime: avgWaitTime,
                avgHandleTime: avgHandleTime,
            }
        }).sort((a, b) => b.totalCalls - a.totalCalls);
    }, [queues, calls]);
  
    if (error) {
        return (
            <div className="space-y-6">
                 <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold">Отчет по очередям</h1>
                        <p className="text-muted-foreground">Детальная аналитика по очередям вызовов</p>
                    </div>
                     <DateRangePicker />
                </div>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Could not load queue data</AlertTitle>
                    <AlertDescription>
                        <p>There was an error connecting to Asterisk or the CDR database. Please check your connection settings in the Admin page.</p>
                        <p className="mt-2 font-mono text-xs">Error: {error}</p>
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">Отчет по очередям</h1>
                    <p className="text-muted-foreground">Детальная аналитика по очередям вызовов</p>
                </div>
                <DateRangePicker />
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Детализация по очередям</CardTitle>
                    <CardDescription>
                        Ключевые показатели для каждой очереди вызовов.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <QueueReportTable data={queueReportData} isLoading={isLoading} />
                </CardContent>
            </Card>
        </div>
    );
}