'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Database, AlertTriangle } from 'lucide-react';
import { CallHistoryTable } from '@/components/reports/call-history-table';
import { getCallHistory, type DateRangeParams } from '@/actions/cdr';
import { getUsers } from '@/actions/users';
import { getConfig } from '@/actions/config';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Call, User } from '@/lib/types';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { subDays, format, parseISO, isValid } from 'date-fns';
import { CallDetailsDialog } from '@/components/operator/call-details-dialog';

export default function ReportsPage() {
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [calls, setCalls] = useState<Call[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedCall, setSelectedCall] = useState<Call | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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
                const [callsResult, usersResult] = await Promise.all([
                    getCallHistory(config.cdr, dateRange),
                    getUsers(),
                ]);

                if (!callsResult.success) {
                    throw new Error(callsResult.error || 'Failed to fetch call history');
                }
                setCalls(callsResult.data || []);
                setUsers(usersResult);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'An unknown error occurred');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [searchParams]);

    const enrichedCalls = useMemo(() => {
        const userMap = new Map(users.filter(u => u.extension).map(user => [user.extension, user.name]));
        return calls.map(call => ({
            ...call,
            operatorName: call.operatorExtension 
                ? (userMap.get(call.operatorExtension) || `Ext. ${call.operatorExtension}`) 
                : 'N/A',
        }));
    }, [calls, users]);

    const handleRowClick = (call: Call) => {
        setSelectedCall(call);
        setIsDetailsOpen(true);
    }

    if (error) {
        return (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Не удалось подключиться к базе данных CDR</AlertTitle>
                <AlertDescription>
                    <p>Произошла ошибка при подключении к базе данных истории звонков. Пожалуйста, проверьте настройки подключения на странице администратора.</p>
                    <p className="mt-2 font-mono text-xs">Ошибка: {error}</p>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <>
        <CallDetailsDialog
            isOpen={isDetailsOpen}
            onOpenChange={setIsDetailsOpen}
            call={selectedCall}
        />
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Отчеты по истории звонков</h1>
                    <p className="text-muted-foreground">Журнал всех звонков за выбранный период.</p>
                </div>
                <DateRangePicker />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Database className="h-8 w-8 text-muted-foreground" />
                        <div>
                            <CardTitle>История звонков</CardTitle>
                            <CardDescription>
                                Журнал звонков за выбранный период. Нажмите на строку для просмотра деталей.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                   <CallHistoryTable calls={enrichedCalls} isLoading={isLoading} onRowClick={handleRowClick} />
                </CardContent>
            </Card>
        </div>
        </>
    );
}
