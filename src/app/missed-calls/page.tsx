import { Filter, Download, PhoneOff, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getMissedCalls } from '@/actions/cdr';
import { getConfig } from '@/actions/config';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MissedCallsTable } from '@/components/reports/missed-calls-table';
import { MissedCallKpiCard } from '@/components/reports/missed-kpi-card';
import type { Call } from '@/lib/types';

function getMissedReason(call: Call): string {
    if (call.status === 'BUSY') return 'Все операторы заняты';
    if (call.status === 'NO ANSWER' && (call.waitTime || 0) > 180) return 'Превышено время ожидания'; // Example: > 3 minutes
    if (call.status === 'FAILED') return 'Техническая проблема';
    return 'Системная ошибка';
}

export default async function MissedCallsPage() {
    const config = await getConfig();
    const missedCallsResult = await getMissedCalls(config.cdr);

    if (!missedCallsResult.success) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Could not connect to CDR Database</AlertTitle>
                <AlertDescription>
                    <p>There was an error connecting to the Call Detail Record database. Please check your connection settings in the Admin page.</p>
                    <p className="mt-2 font-mono text-xs">Error: {missedCallsResult.error}</p>
                </AlertDescription>
            </Alert>
        )
    }

    const calls: Call[] = missedCallsResult.data || [];
    
    const callsWithReason = calls.map(call => ({
        ...call,
        reason: getMissedReason(call)
    }));

    const totalMissed = calls.length;
    const totalWaitTime = calls.reduce((acc, call) => acc + (call.waitTime || 0), 0);
    const averageWaitTime = totalMissed > 0 ? totalWaitTime / totalMissed : 0;
    const maxWaitTime = Math.max(0, ...calls.map(call => call.waitTime || 0));

    const reasonCounts = callsWithReason.reduce((acc, call) => {
        acc[call.reason!] = (acc[call.reason!] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const mainReason = Object.keys(reasonCounts).length > 0
        ? Object.entries(reasonCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0]
        : 'N/A';
    
    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-destructive-foreground">Пропущенные звонки</h1>
                    <p className="text-muted-foreground">Анализ пропущенных звонков и их причин</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" /> CSV
                    </Button>
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" /> PDF
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Filter className="h-5 w-5" />
                        Фильтры и поиск
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-4">
                    <Input placeholder="Поиск по номеру, очереди или причине..." />
                    <Select>
                        <SelectTrigger>
                            <SelectValue placeholder="Все очереди" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Все очереди</SelectItem>
                        </SelectContent>
                    </Select>
                     <Select>
                        <SelectTrigger>
                            <SelectValue placeholder="Сегодня" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Сегодня</SelectItem>
                            <SelectItem value="yesterday">Вчера</SelectItem>
                            <SelectItem value="week">За неделю</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MissedCallKpiCard icon={PhoneOff} title="Пропущенные звонки" value={totalMissed.toString()} />
                <MissedCallKpiCard icon={Clock} title="Среднее время ожидания" value={formatTime(averageWaitTime)} />
                <MissedCallKpiCard icon={AlertTriangle} title="Максимальное ожидание" value={formatTime(maxWaitTime)} />
                <MissedCallKpiCard icon={TrendingUp} title="Основная причина" value={mainReason} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Детальный список пропущенных звонков</CardTitle>
                    <CardDescription>
                        Показано {callsWithReason.length} из {callsWithReason.length} пропущенных звонков
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <MissedCallsTable calls={callsWithReason} />
                </CardContent>
            </Card>
        </div>
    );
}
