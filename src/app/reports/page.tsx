'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { getCallHistory, type DateRangeParams, type GetCallHistoryParams } from '@/actions/cdr';
import { getUsers } from '@/actions/users';
import { getAppeals } from '@/actions/appeals';
import { getConfig } from '@/actions/config';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Call, User, Appeal } from '@/lib/types';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { subDays, format, parseISO, isValid } from 'date-fns';
import { OperatorReportTable, type OperatorReportData } from '@/components/reports/operator-report-table';
import { Button } from '@/components/ui/button';
import { CallHistoryTable, type EnrichedOperatorCall } from '@/components/reports/call-history-table';
import { exportOperatorReport } from '@/actions/export';
import { useToast } from '@/hooks/use-toast';


const findAppealByFlexibleId = (appeals: Appeal[], callId: string): Appeal | undefined => {
    let appeal = appeals.find(a => a.callId === callId);
    if (appeal) return appeal;

    if (callId.includes('.')) {
        const callIdBase = callId.substring(0, callId.lastIndexOf('.'));
        appeal = appeals.find(a => a.callId.startsWith(callIdBase));
        if (appeal) return appeal;
    }
    
    return undefined;
};

export default function ReportsPage() {
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [calls, setCalls] = useState<Call[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [appeals, setAppeals] = useState<Appeal[]>([]);

    const [selectedOperator, setSelectedOperator] = useState<User | null>(null);
    const [operatorCalls, setOperatorCalls] = useState<EnrichedOperatorCall[]>([]);
    const [isLoadingOperatorCalls, setIsLoadingOperatorCalls] = useState(false);
    const [isExporting, startExportTransition] = useTransition();
    const { toast } = useToast();

    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalOperatorCalls, setTotalOperatorCalls] = useState(0);

    const dateRange = useMemo(() => {
        const toParam = searchParams.get('to');
        const fromParam = searchParams.get('from');
        const to = toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : new Date();
        const from = fromParam && isValid(parseISO(fromParam)) ? parseISO(fromParam) : subDays(to, 6);
        return { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };
    }, [searchParams]);
    
    // Reset page when operator changes
    useEffect(() => {
        setPage(1);
    }, [selectedOperator]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const config = await getConfig();
                // Fetch all data for the summary table without pagination
                const [callsResult, usersResult, appealsResult] = await Promise.all([
                    getCallHistory(config.cdr, dateRange),
                    getUsers(),
                    getAppeals(),
                ]);

                if (!callsResult.success) {
                    throw new Error(callsResult.error || 'Failed to fetch call history');
                }
                setCalls(callsResult.data || []);
                setUsers(usersResult);
                setAppeals(appealsResult);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'An unknown error occurred');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [dateRange]);

    useEffect(() => {
        const fetchOperatorCalls = async () => {
            if (!selectedOperator?.extension) {
                setOperatorCalls([]);
                return;
            };
            setIsLoadingOperatorCalls(true);
            try {
                const config = await getConfig();
                const params: GetCallHistoryParams = {
                    from: dateRange.from,
                    to: dateRange.to,
                    operatorExtension: selectedOperator.extension,
                    page,
                    limit
                };
                const callsResult = await getCallHistory(config.cdr, params);
                if (callsResult.success && callsResult.data) {
                    const userMap = new Map(users.map(u => [u.extension, u.name]));
                    const enrichedCalls = callsResult.data
                        .map((call): EnrichedOperatorCall => {
                            const appeal = findAppealByFlexibleId(appeals, call.id);
                            return { 
                                ...call, 
                                operatorName: userMap.get(call.operatorExtension!),
                                queueName: call.queue || '-',
                                resolution: appeal?.resolution || '-'
                            };
                        });
                    setOperatorCalls(enrichedCalls);
                    setTotalOperatorCalls(callsResult.total || 0);
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

        fetchOperatorCalls();
    }, [selectedOperator, dateRange, page, limit, users, appeals]);

    const handleOperatorClick = async (operatorId: string) => {
        const user = users.find(u => u.id === operatorId);
        if (!user) return;
        
        if (selectedOperator?.id === operatorId) {
            setSelectedOperator(null);
        } else {
            setSelectedOperator(user);
        }
    };
    
    const handleExport = () => {
        startExportTransition(async () => {
            const result = await exportOperatorReport(dateRange);
            if (result.success && result.data) {
                // Decode Base64 and create a Blob
                const byteCharacters = atob(result.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `operator_report_${dateRange.from}_${dateRange.to}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
                 toast({ title: "Экспорт завершен", description: "Файл отчета успешно создан." });
            } else {
                toast({ variant: 'destructive', title: "Ошибка экспорта", description: result.error });
            }
        });
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
            
            const missedCallsCount = operatorCalls.filter(c => c.operatorExtension === operator.extension && c.status !== 'ANSWERED').length;
            const totalIncoming = answeredIncomingCalls.length + missedCallsCount;
            const missedCallsPercentage = totalIncoming > 0 ? (missedCallsCount / totalIncoming) * 100 : 0;
            
            const totalTalkTime = answeredIncomingCalls.reduce((acc, c) => acc + (c.billsec || 0), 0);
            const avgTalkTime = answeredIncomingCalls.length > 0 ? totalTalkTime / answeredIncomingCalls.length : 0;
            
            const totalWaitTime = answeredIncomingCalls.reduce((acc, c) => acc + (c.waitTime || 0), 0);
            const avgWaitTime = answeredIncomingCalls.length > 0 ? totalWaitTime / answeredIncomingCalls.length : 0;

            const callTimestamps = operatorCalls.map(c => parseISO(c.startTime).getTime());
            const firstCallTime = callTimestamps.length > 0 ? new Date(Math.min(...callTimestamps)) : null;
            const lastCallTime = callTimestamps.length > 0 ? new Date(Math.max(...callTimestamps)) : null;

            const satisfactionScores = answeredIncomingCalls
                .map(c => c.satisfaction ? parseInt(c.satisfaction, 10) : NaN)
                .filter(s => !isNaN(s));
            
            const avgSatisfaction = satisfactionScores.length > 0 
                ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length
                : 0;

            
            return {
                operatorId: operator.id,
                operatorName: operator.name,
                firstCallTime: firstCallTime ? firstCallTime.toISOString() : null,
                lastCallTime: lastCallTime ? lastCallTime.toISOString() : null,
                answeredIncomingCount: answeredIncomingCalls.length,
                outgoingCount: outgoingCalls.length,
                missedCallsPercentage: missedCallsPercentage,
                missedCallsCount: missedCallsCount,
                avgTalkTime: avgTalkTime,
                avgWaitTime: avgWaitTime,
                satisfactionScore: avgSatisfaction,
                transferredToSupervisorCount: 0, 
            };
        }).filter((data): data is OperatorReportData => data !== null);

    }, [calls, users, appeals]);

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
                     <Button variant="outline" onClick={handleExport} disabled={isExporting}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        {isExporting ? 'Экспорт...' : 'Экспорт в Excel'}
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
                            <h3 className="text-lg font-semibold mb-2">Звонки оператора: {selectedOperator.name}</h3>
                            <CallHistoryTable 
                                calls={operatorCalls}
                                isLoading={isLoadingOperatorCalls}
                                user={selectedOperator}
                                page={page}
                                limit={limit}
                                total={totalOperatorCalls}
                                onPageChange={setPage}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
