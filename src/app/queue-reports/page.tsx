import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, BarChart, Clock, Percent, PhoneIncoming, PhoneMissed } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getConfig } from '@/actions/config';
import { getCallHistory } from '@/actions/cdr';
import { getAmiQueues } from '@/actions/ami';
import type { Call, AsteriskQueue, QueueReportData } from '@/lib/types';
import { QueueReportTable } from '@/components/reports/queue-report-table';

const SLA_TARGET_SECONDS = 30;

export default async function QueueReportsPage() {
    const config = await getConfig();
    const [queuesResult, callsResult] = await Promise.all([
        getAmiQueues(config.ami),
        getCallHistory(config.cdr)
    ]);

    if (!queuesResult.success || !callsResult.success) {
        const error = !queuesResult.success ? queuesResult.error : callsResult.error;
        return (
            <div className="space-y-6">
                 <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold">Отчет по очередям</h1>
                        <p className="text-muted-foreground">Детальная аналитика по очередям вызовов</p>
                    </div>
                </div>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Could not load queue data</AlertTitle>
                    <AlertDescription>
                        <p>There was an error connecting to Asterisk or the CDR database. Please check your connection settings in the Admin page.</p>
                        <p className="mt-2 font-mono text-xs">Error: {error}</p>
                    </AlertDescription>
                </Alert>
            </div>
        )
    }
    
    const queues: AsteriskQueue[] = queuesResult.data || [];
    const calls: Call[] = callsResult.data || [];

    const queueReportData = queues.map(queue => {
        const queueCalls = calls.filter(c => c.queue === queue.name);
        const answeredCalls = queueCalls.filter(c => c.status === 'ANSWERED' && c.waitTime !== undefined && c.billsec !== undefined);
        const missedCalls = queueCalls.filter(c => c.status !== 'ANSWERED');

        const totalCalls = queueCalls.length;
        const totalAnswered = answeredCalls.length;

        const callsAnsweredWithinSla = answeredCalls.filter(c => c.waitTime! <= SLA_TARGET_SECONDS).length;
        const sla = totalAnswered > 0 ? (callsAnsweredWithinSla / totalAnswered) * 100 : 0;

        const totalWaitTime = answeredCalls.reduce((acc, c) => acc + c.waitTime!, 0);
        const avgWaitTime = totalAnswered > 0 ? totalWaitTime / totalAnswered : 0;

        const totalHandleTime = answeredCalls.reduce((acc, c) => acc + c.billsec!, 0);
        const avgHandleTime = totalAnswered > 0 ? totalHandleTime / totalAnswered : 0;

        const abandonmentRate = totalCalls > 0 ? (missedCalls.length / totalCalls) * 100 : 0;

        return {
            queueName: queue.name,
            totalCalls: totalCalls,
            answeredCalls: totalAnswered,
            missedCalls: missedCalls.length,
            abandonmentRate: abandonmentRate,
            sla: sla,
            avgWaitTime: avgWaitTime,
            avgHandleTime: avgHandleTime,
        }
    }).sort((a,b) => b.totalCalls - a.totalCalls); // Sort by most active queues
  
  return (
    <div className="space-y-6">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold">Отчет по очередям</h1>
                <p className="text-muted-foreground">Детальная аналитика по очередям вызовов за последние 24 часа</p>
            </div>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Детализация по очередям</CardTitle>
                <CardDescription>
                    Ключевые показатели для каждой очереди вызовов.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <QueueReportTable data={queueReportData} />
            </CardContent>
        </Card>
    </div>
  );
}
