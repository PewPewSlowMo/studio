'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Call, User } from '@/lib/types';
import { getConfig } from '@/actions/config';
import { getCallHistory } from '@/actions/cdr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Phone, Clock, MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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
            try {
                const config = await getConfig();
                const result = await getCallHistory(config.cdr);
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
    }, [user]);

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
    
    if (isLoading) {
        return (
             <div className="grid gap-4 md:grid-cols-3">
                <KpiSkeleton />
                <KpiSkeleton />
                <KpiSkeleton />
            </div>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="Всего отвечено" value={kpiData.totalAnswered.toString()} icon={Phone} />
            <KpiCard title="Общее время разговора" value={formatTime(kpiData.totalTalkTime)} icon={MessageSquare} />
            <KpiCard title="Среднее время обработки" value={formatTime(kpiData.avgHandleTime)} icon={Clock} />
        </div>
    );
}