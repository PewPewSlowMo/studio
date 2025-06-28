'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CallHistoryTable } from '@/components/reports/call-history-table';
import { getCallHistory, type DateRangeParams } from '@/actions/cdr';
import { getConfig } from '@/actions/config';
import type { Call, User } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { subDays, format, parseISO, isValid } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface MyCallsTabProps {
    user: User;
}

export function MyCallsTab({ user }: MyCallsTabProps) {
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
                    const userMap = new Map([[user.extension, user.name]]);
                    const filteredCalls = result.data
                        .filter(call => call.operatorExtension === user.extension)
                        .map(call => ({
                            ...call,
                            operatorName: userMap.get(call.operatorExtension!) || `Ext. ${call.operatorExtension}`
                        }));
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
         <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>История моих звонков</CardTitle>
                        <CardDescription>
                            Список всех обработанных вами вызовов за выбранный период.
                        </CardDescription>
                    </div>
                    <DateRangePicker />
                </div>
            </CardHeader>
            <CardContent>
                <CallHistoryTable calls={calls} isLoading={isLoading} />
            </CardContent>
        </Card>
    );
}
