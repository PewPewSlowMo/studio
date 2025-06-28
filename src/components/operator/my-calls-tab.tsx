'use client';
import { useState, useEffect, useMemo } from 'react';
import { CallHistoryTable } from '@/components/reports/call-history-table';
import { getCallHistory } from '@/actions/cdr';
import { getConfig } from '@/actions/config';
import type { Call, User } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface MyCallsTabProps {
    user: User;
}

export function MyCallsTab({ user }: MyCallsTabProps) {
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
                const result = await getCallHistory(config.cdr); // Fetches last 24h by default, we can add date picker later
                if (result.success && result.data) {
                    const userMap = new Map([[user.extension, user.name]]); // simpler map for just this user
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
    }, [user]);

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Ошибка загрузки</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }
    
    return <CallHistoryTable calls={calls} isLoading={isLoading} />;
}
