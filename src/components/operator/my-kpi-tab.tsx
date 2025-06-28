'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Call, User } from '@/lib/types';
import { getConfig } from '@/actions/config';
import { getCallHistory, type DateRangeParams } from '@/actions/cdr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Phone, Clock, MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { subDays, format, parseISO, isValid } from 'date-fns';

interface MyKpiTabProps {
    user: User;
}

function KpiCard({ title, value, icon: Icon }: { title: string, value: string, icon: React.ElementType }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
}

function KpiSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-8 w-16" />
            </CardContent>
        </Card>
    );
}

const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    let result = '';
    if (hours > 0) result += `${hours}ч `;
    if (minutes > 0 || hours > 0) result += `${minutes}м `;
    result += `${secs}с`;
    return result.trim();
};

export function MyKpiTab({ user }: MyKpiTabProps) {
    const searchParams = useSearchParams();
    const [calls, setCalls] = useState<Call[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCalls = async () => {
            if (!user.extension) {
                setError('У пользователя нет внутреннего номера.');
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                const toParam = searchParams.get('to');
                const fromParam = searchParams.get('from');

                const to = toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : new Date();
                const from = fromParam && isValid(parseISO(fromParam)) ? parseISO(fromParam) : subDays(to, 6);
                const dateRange: DateRangeParams = { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };

                const config = await getConfig();
                const result = await getCallHistory(config.cdr, dateRange);
                if (result.success && result.data) {
                    const filteredCalls = result.data.filter(call => call.operatorExtension === user.extension);
                    setCalls(filteredCalls);
                } else {
                    setError(result.error || 'Не удалось загрузить историю звонков.');
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Произошла неизвестная ошибка.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchCalls();
    }, [user, searchParams]);

    const kpiData = useMemo(() => {
        const answeredCalls = calls.filter(c => c.status === 'ANSWERED' && c.billsec !== undefined);
        const totalAnswered = answeredCalls.length;
        const totalTalkTime = answeredCalls.reduce((acc, c) => acc + (c.billsec || 0), 0);
        const avgHandleTime = totalAnswered > 0 ? totalTalkTime / totalAnswered : 0;

        return {
            totalAnswered,
            totalTalkTime,
            avgHandleTime,
        };
    }, [calls]);

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Ошибка загрузки</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold">Мои показатели эффективности</h2>
                    <p className="text-muted-foreground">Ваши KPI за выбранный период.</p>
                </div>
                 <DateRangePicker />
            </div>

            {isLoading ? (
                 <div className="grid gap-4 md:grid-cols-3">
                    <KpiSkeleton />
                    <KpiSkeleton />
                    <KpiSkeleton />
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-3">
                    <KpiCard title="Всего отвечено" value={kpiData.totalAnswered.toString()} icon={Phone} />
                    <KpiCard title="Общее время разговора" value={formatTime(kpiData.totalTalkTime)} icon={MessageSquare} />
                    <KpiCard title="Среднее время обработки" value={formatTime(kpiData.avgHandleTime)} icon={Clock} />
                </div>
            )}
        </div>
    );
}
