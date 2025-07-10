'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { MyCallsTable } from '@/components/operator/my-calls-table';
import { getCallHistory, type DateRangeParams } from '@/actions/cdr';
import { getConfig } from '@/actions/config';
import { getContacts } from '@/actions/crm';
import { getAppeals } from '@/actions/appeals';
import type { Call, User, Appeal } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { subDays, format, parseISO, isValid } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CallDetailsDialog } from '@/components/operator/call-details-dialog';

type EnrichedCall = Call & {
    callerName?: string;
    cardFilled?: boolean;
    category?: Appeal['category'];
    followUp?: boolean;
    followUpCompleted?: boolean;
};

export default function MyCallsPage() {
    const searchParams = useSearchParams();
    const [user, setUser] = useState<User | null>(null);
    const [calls, setCalls] = useState<EnrichedCall[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCall, setSelectedCall] = useState<Call | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        } else {
            setError('Пользователь не авторизован.');
        }
    }, []);

    useEffect(() => {
        if (!user) return;

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
                const appealMap = new Map(appeals.map(a => [a.callId, a]));

                const userCalls = callsResult.data
                    .filter(call => call.operatorExtension === user.extension)
                    .map((call): EnrichedCall => {
                        const appeal = appealMap.get(call.id);
                        return {
                            ...call,
                            callerName: contactMap.get(call.callerNumber),
                            cardFilled: !!appeal,
                            category: appeal?.category,
                            followUp: appeal?.followUp,
                            followUpCompleted: appeal?.followUpCompleted,
                        }
                    });

                setCalls(userCalls);

            } catch (e) {
                setError(e instanceof Error ? e.message : 'Произошла неизвестная ошибка.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndEnrichCalls();
    }, [user, searchParams]);
    
    const handleRowClick = (call: Call) => {
        setSelectedCall(call);
        setIsDetailsOpen(true);
    };

    if (!user && !error) {
        return (
             <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

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
            <CallDetailsDialog 
                isOpen={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                call={selectedCall}
                user={user}
                isCrmEditable={false}
            />
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
                    <MyCallsTable calls={calls} isLoading={isLoading} onRowClick={handleRowClick} />
                </CardContent>
            </Card>
        </>
    );
}
