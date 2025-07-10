'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, AlertTriangle, Download } from 'lucide-react';
import { getCallHistory, type DateRangeParams } from '@/actions/cdr';
import { getUsers } from '@/actions/users';
import { getConfig } from '@/actions/config';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Call, User } from '@/lib/types';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { subDays, format, parseISO, isValid } from 'date-fns';
import { OperatorReportTable, type OperatorReportData } from '@/components/reports/operator-report-table';
import { Button } from '@/components/ui/button';
import { CallHistoryTable } from '@/components/reports/call-history-table';

export default function ReportsPage() {
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [calls, setCalls] = useState<Call[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    const [selectedOperator, setSelectedOperator] = useState<User | null>(null);
    const [operatorCalls, setOperatorCalls] = useState<Call[]>([]);
    const [isLoadingOperatorCalls, setIsLoadingOperatorCalls] = useState(false);
    
    const dateRange = useMemo(() => {
        const toParam = searchParams.get('to');
        const fromParam = searchParams.get('from');
        const to = toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : new Date();
        const from = fromParam && isValid(parseISO(fromParam)) ? parseISO(fromParam) : subDays(to, 6);
        return { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };
    }, [searchParams]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
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
    }, [dateRange]);

    const handleOperatorClick = async (operatorId: string) => {
        const user = users.find(u => u.id === operatorId);
        if (!user) return;
        
        if (selectedOperator?.id === operatorId) {
            // If the same operator is clicked, collapse the view
            setSelectedOperator(null);
            setOperatorCalls([]);
            return;
        }

        setSelectedOperator(user);
        setIsLoadingOperatorCalls(true);
        try {
            const config = await getConfig();
            const params: DateRangeParams = {
                ...dateRange,
                operatorExtension: user.extension!,
            };
            const callsResult = await getCallHistory(config.cdr, params);
            if (callsResult.success && callsResult.data) {
                const userMap = new Map(users.map(u => [u.extension, u.name]));
                const enrichedCalls = callsResult.data
                    .filter(c => c.status === 'ANSWERED')
                    .map(c => ({ ...c, operatorName: userMap.get(c.operatorExtension!) }));
                setOperatorCalls(enrichedCalls);
            } else {
                setError(callsResult.error || 'Failed to fetch calls for this operator.');
                setOperatorCalls([]);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
            setOperatorCalls([]);
        } finally {
            setIsLoadingOperatorCalls(false);
        }
    };

    const operatorReportData = useMemo(() => {
        const operators = users.filter(u => u.role === 'operator' && u.extension);
        
        return operators.map(operator => {
            const operatorCalls = calls.filter(c => c.operatorExtension === operator.extension || c.callerNumber === operator.extension);

            if (operatorCalls.length === 0) {
                return null;
            }
            
            const answeredIncomingCalls = operatorCalls.filter(c => c.status === 'ANSWERED' && c.operatorExtension === operator.extension);
            const outgoingCalls = operatorCalls.filter(c => c.isOutgoing && c.callerNumber === operator.extension);
            
            const totalCallsHandled = answeredIncomingCalls.length + outgoingCalls.length;
            const missedCallsCount = operatorCalls.filter(c => c.operatorExtension === operator.extension && c.status !== 'ANSWERED').length;
            const missedCallsPercentage = totalCallsHandled + missedCallsCount > 0 ? (missedCallsCount / (totalCallsHandled + missedCallsCount)) * 100 : 0;
            
            const totalTalkTime = answeredIncomingCalls.reduce((acc, c) => acc + (c.billsec || 0), 0);
            const avgTalkTime = answeredIncomingCalls.length > 0 ? totalTalkTime / answeredIncomingCalls.length : 0;
            
            const totalWaitTime = answeredIncomingCalls.reduce((acc, c) => acc + (c.waitTime || 0), 0);
            const avgWaitTime = answeredIncomingCalls.length > 0 ? totalWaitTime / answeredIncomingCalls.length : 0;

            const callTimestamps = operatorCalls.map(c => parseISO(c.startTime).getTime());
            const firstCallTime = callTimestamps.length > 0 ? new Date(Math.min(...callTimestamps)) : null;
            const lastCallTime = callTimestamps.length > 0 ? new Date(Math.max(...callTimestamps)) : null;
            
            return {
                operatorId: operator.id,
                operatorName: operator.name,
                firstCallTime: firstCallTime ? firstCallTime.toISOString() : null,
                lastCallTime: lastCallTime ? lastCallTime.toISOString() : null,
                answeredIncomingCount: answeredIncomingCalls.length,
                outgoingCount: outgoingCalls.length,
                missedCallsPercentage: missedCallsPercentage,
                avgTalkTime: avgTalkTime,
                avgWaitTime: avgWaitTime,
                satisfactionScore: 'N/A', 
                transferredToSupervisorCount: 0, 
            };
        }).filter((data): data is OperatorReportData => data !== null);

    }, [calls, users]);

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
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Отчет по операторам</h1>
                    <p className="text-muted-foreground">Сводные показатели эффективности по каждому оператору.</p>
                </div>
                <div className="flex items-center gap-2">
                    <DateRangePicker />
                     <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" /> CSV
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Users className="h-8 w-8 text-muted-foreground" />
                        <div>
                            <CardTitle>Эффективность операторов</CardTitle>
                            <CardDescription>
                               Ключевые показатели для каждого оператора за выбранный период. Нажмите на строку для просмотра звонков.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                   <OperatorReportTable 
                        data={operatorReportData} 
                        isLoading={isLoading} 
                        onOperatorClick={handleOperatorClick}
                        selectedOperatorId={selectedOperator?.id || null}
                    />
                     {selectedOperator && (
                        <div className="mt-6 p-4 border-t">
                            <h3 className="text-lg font-semibold mb-2">Принятые звонки: {selectedOperator.name}</h3>
                            <CallHistoryTable 
                                calls={operatorCalls}
                                isLoading={isLoadingOperatorCalls}
                                user={selectedOperator}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
