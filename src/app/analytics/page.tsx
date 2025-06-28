'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart3, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { AnalyticsKpiCard } from '@/components/analytics/analytics-kpi-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getConfig } from '@/actions/config';
import { getCallHistory, type DateRangeParams } from '@/actions/cdr';
import type { Call, User } from '@/lib/types';
import { OperatorPerformanceChart } from '@/components/analytics/operator-performance-chart';
import { QueueDistributionChart } from '@/components/analytics/queue-distribution-chart';
import { getUsers } from '@/actions/users';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays, format, parseISO, isValid, differenceInDays } from 'date-fns';

const SLA_TARGET_SECONDS = 30;

function KpiCardSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-2">
                <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-7 w-1/2 mb-2" />
                <Skeleton className="h-3 w-full mb-4" />
                <Skeleton className="h-3 w-3/4" />
            </CardContent>
        </Card>
    );
}

export default function AnalyticsPage() {
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentCalls, setCurrentCalls] = useState<Call[]>([]);
    const [previousCalls, setPreviousCalls] = useState<Call[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const toParam = searchParams.get('to');
                const fromParam = searchParams.get('from');

                const to = toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : new Date();
                const from = fromParam && isValid(parseISO(fromParam)) ? parseISO(fromParam) : subDays(to, 6);

                const duration = differenceInDays(to, from);
                const previousTo = subDays(from, 1);
                const previousFrom = subDays(previousTo, duration);

                const currentDateRange: DateRangeParams = { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };
                const previousDateRange: DateRangeParams = { from: format(previousFrom, 'yyyy-MM-dd'), to: format(previousTo, 'yyyy-MM-dd') };

                const config = await getConfig();
                const [currentCallsResult, previousCallsResult, usersResult] = await Promise.all([
                    getCallHistory(config.cdr, currentDateRange),
                    getCallHistory(config.cdr, previousDateRange),
                    getUsers()
                ]);

                if (!currentCallsResult.success) {
                    throw new Error(currentCallsResult.error || 'Failed to fetch current call history');
                }
                 if (!previousCallsResult.success) {
                    throw new Error(previousCallsResult.error || 'Failed to fetch previous call history');
                }
                setCurrentCalls(currentCallsResult.data || []);
                setPreviousCalls(previousCallsResult.data || []);
                setUsers(usersResult);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'An unknown error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [searchParams]);

    const analyticsData = useMemo(() => {
        const calculateKpis = (callsToAnalyze: Call[]) => {
            const answeredCalls = callsToAnalyze.filter(c => c.status === 'ANSWERED' && c.waitTime !== undefined && c.billsec !== undefined);
            const missedCalls = callsToAnalyze.filter(c => c.status !== 'ANSWERED');
            const totalCalls = callsToAnalyze.length;

            const callsAnsweredWithinSla = answeredCalls.filter(c => c.waitTime! <= SLA_TARGET_SECONDS).length;
            const serviceLevel = answeredCalls.length > 0 ? (callsAnsweredWithinSla / answeredCalls.length) * 100 : 0;

            const totalWaitTime = answeredCalls.reduce((acc, c) => acc + c.waitTime!, 0);
            const averageSpeedOfAnswer = answeredCalls.length > 0 ? totalWaitTime / answeredCalls.length : 0;

            const totalHandleTime = answeredCalls.reduce((acc, c) => acc + c.billsec!, 0);
            const averageHandleTime = answeredCalls.length > 0 ? totalHandleTime / answeredCalls.length : 0;

            const abandonmentRate = totalCalls > 0 ? (missedCalls.length / totalCalls) * 100 : 0;

            return { serviceLevel, averageSpeedOfAnswer, averageHandleTime, abandonmentRate, missedCallsCount: missedCalls.length, totalCalls };
        };
        
        const calculateTrend = (current: number, previous: number) => {
            if (previous === 0) {
                if (current > 0) return { trendValue: '+100.0%', trendDirection: 'up' as const };
                return { trendValue: '0.0%', trendDirection: 'neutral' as const };
            }
            const percentageChange = ((current - previous) / previous) * 100;
            
            let trendDirection: 'up' | 'down' | 'neutral' = 'neutral';
            if (percentageChange > 0.1) trendDirection = 'up';
            if (percentageChange < -0.1) trendDirection = 'down';

            return {
                trendValue: `${percentageChange >= 0 ? '+' : ''}${percentageChange.toFixed(1)}%`,
                trendDirection,
            };
        };
        
        const currentKpis = calculateKpis(currentCalls);
        const previousKpis = calculateKpis(previousCalls);

        const userMap = new Map(users.filter(u => u.extension).map(u => [u.extension!, u.name]));
        const answeredCallsForCharts = currentCalls.filter(c => c.status === 'ANSWERED' && c.billsec !== undefined);
        const operatorPerformanceData = answeredCallsForCharts.reduce((acc, call) => {
            if (call.operatorExtension) {
                const name = userMap.get(call.operatorExtension) || `Ext. ${call.operatorExtension}`;
                if (!acc[name]) {
                    acc[name] = { answered: 0, totalTalkTime: 0 };
                }
                acc[name].answered++;
                acc[name].totalTalkTime += call.billsec || 0;
            }
            return acc;
        }, {} as Record<string, { answered: number; totalTalkTime: number }>);

        const operatorChartData = Object.entries(operatorPerformanceData).map(([name, data]) => ({
            operator: name,
            answered: data.answered,
            avgHandleTime: data.answered > 0 ? data.totalTalkTime / data.answered : 0
        })).sort((a, b) => b.answered - a.answered);

        const queueDistribution = currentCalls.reduce((acc, call) => {
            const queueName = call.queue || 'Без очереди';
            if (queueName) {
                acc[queueName] = (acc[queueName] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        const queueChartData = Object.entries(queueDistribution)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
            
        return { 
            serviceLevel: { ...calculateTrend(currentKpis.serviceLevel, previousKpis.serviceLevel), value: currentKpis.serviceLevel },
            averageSpeedOfAnswer: { ...calculateTrend(currentKpis.averageSpeedOfAnswer, previousKpis.averageSpeedOfAnswer), value: currentKpis.averageSpeedOfAnswer },
            averageHandleTime: { ...calculateTrend(currentKpis.averageHandleTime, previousKpis.averageHandleTime), value: currentKpis.averageHandleTime },
            abandonmentRate: { ...calculateTrend(currentKpis.abandonmentRate, previousKpis.abandonmentRate), value: currentKpis.abandonmentRate },
            missedCalls: currentKpis.missedCallsCount, 
            totalCalls: currentKpis.totalCalls, 
            operatorChartData, 
            queueChartData 
        };

    }, [currentCalls, previousCalls, users]);

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}м ${secs.toString().padStart(2, '0')}с`;
    };

    if (error) {
        return (
            <div className="space-y-6">
                 <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold">Аналитика</h1>
                        <p className="text-muted-foreground">Ключевые показатели эффективности колл-центра</p>
                    </div>
                    <DateRangePicker />
                </div>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Could not load analytics data</AlertTitle>
                    <AlertDescription>
                        <p>There was an error connecting to the required services. Please check your connection settings in the Admin page.</p>
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
                    <h1 className="text-3xl font-bold">Аналитика</h1>
                    <p className="text-muted-foreground">Ключевые показатели эффективности колл-центра</p>
                </div>
                 <DateRangePicker />
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
                    <AnalyticsKpiCard 
                        title="Уровень обслуживания (SLA)"
                        value={`${analyticsData.serviceLevel.value.toFixed(1)}%`}
                        description={`Отвечено за ${SLA_TARGET_SECONDS} сек.`}
                        trendValue={analyticsData.serviceLevel.trendValue}
                        trendDirection={analyticsData.serviceLevel.trendDirection}
                    />
                    <AnalyticsKpiCard 
                        title="Среднее время ответа (ASA)"
                        value={formatTime(analyticsData.averageSpeedOfAnswer.value)}
                        description="Среднее время до ответа"
                        trendValue={analyticsData.averageSpeedOfAnswer.trendValue}
                        trendDirection={analyticsData.averageSpeedOfAnswer.trendDirection}
                    />
                    <AnalyticsKpiCard 
                        title="Среднее время обработки (AHT)"
                        value={formatTime(analyticsData.averageHandleTime.value)}
                        description="Разговор + удержание"
                        trendValue={analyticsData.averageHandleTime.trendValue}
                        trendDirection={analyticsData.averageHandleTime.trendDirection}
                    />
                    <AnalyticsKpiCard 
                        title="Процент потерянных"
                        value={`${analyticsData.abandonmentRate.value.toFixed(1)}%`}
                        description={`${analyticsData.missedCalls} из ${analyticsData.totalCalls} звонков`}
                        trendValue={analyticsData.abandonmentRate.trendValue}
                        trendDirection={analyticsData.abandonmentRate.trendDirection}
                    />
                </div>
            )}
            
            <div className="grid gap-6 lg:grid-cols-2">
                 <Card>
                    <CardHeader>
                        <CardTitle>Производительность операторов</CardTitle>
                        <CardDescription>
                            Количество отвеченных вызовов и среднее время обработки.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[350px]" /> : <OperatorPerformanceChart data={analyticsData.operatorChartData} />}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Распределение звонков по очередям</CardTitle>
                        <CardDescription>
                           Процентное соотношение общего числа звонков по очередям.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         {isLoading ? <Skeleton className="h-[350px]" /> : <QueueDistributionChart data={analyticsData.queueChartData} />}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
