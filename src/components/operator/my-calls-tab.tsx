'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { MyCallsTable } from './my-calls-table'; // New component
import { getCallHistory, type DateRangeParams } from '@/actions/cdr';
import { getConfig } from '@/actions/config';
import { getContacts } from '@/actions/crm'; // New function
import { getAppeals } from '@/actions/appeals';
import type { Call, User, CrmContact, Appeal } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { subDays, format, parseISO, isValid } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface MyCallsTabProps {
    user: User;
}

type EnrichedCall = Call & {
    callerName?: string;
    appealDescription?: string;
};

export function MyCallsTab({ user }: MyCallsTabProps) {
    const searchParams = useSearchParams();
    const [calls, setCalls] = useState<EnrichedCall[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAndEnrichCalls = async () => {
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
                const [callsResult, contacts, appeals] = await Promise.all([
                    getCallHistory(config.cdr, dateRange),
                    getContacts(),
                    getAppeals()
                ]);

                if (!callsResult.success || !callsResult.data) {
                    throw new Error(callsResult.error || 'Не удалось загрузить историю звонков.');
                }
                
                const contactMap = new Map(contacts.map(c => [c.phoneNumber, c.name]));
                const appealMap = new Map(appeals.map(a => [a.callId, a.description]));

                const userCalls = callsResult.data
                    .filter(call => call.operatorExtension === user.extension)
                    .map((call): EnrichedCall => ({
                        ...call,
                        callerName: contactMap.get(call.callerNumber),
                        appealDescription: appealMap.get(call.id)
                    }));

                setCalls(userCalls);

            } catch (e) {
                setError(e instanceof Error ? e.message : 'Произошла неизвестная ошибка.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndEnrichCalls();
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
        <>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>История моих звонков</CardTitle>
                            <CardDescription>
                                Нажмите на строку, чтобы раскрыть детали обращения.
                            </CardDescription>
                        </div>
                        <DateRangePicker />
                    </div>
                </CardHeader>
                <CardContent>
                    <MyCallsTable calls={calls} isLoading={isLoading} />
                </CardContent>
            </Card>
        </>
    );
}
