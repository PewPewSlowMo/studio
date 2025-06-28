import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnalyticsKpiCard } from '@/components/analytics/analytics-kpi-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getConfig } from '@/actions/config';
import { getCallHistory } from '@/actions/cdr';
import type { Call } from '@/lib/types';
import { OperatorPerformanceChart } from '@/components/analytics/operator-performance-chart';
import { getUsers } from '@/actions/users';

const SLA_TARGET_SECONDS = 30;

export default async function AnalyticsPage() {
    const config = await getConfig();
    const [callsResult, users] = await Promise.all([
        getCallHistory(config.cdr),
        getUsers()
    ]);

    if (!callsResult.success) {
        return (
            <div className="space-y-6">
                 <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold">Аналитика</h1>
                        <p className="text-muted-foreground">Ключевые показатели эффективности колл-центра</p>
                    </div>
                </div>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Could not connect to CDR Database</AlertTitle>
                    <AlertDescription>
                        <p>There was an error connecting to the Call Detail Record database. Please check your connection settings in the Admin page.</p>
                        <p className="mt-2 font-mono text-xs">Error: {callsResult.error}</p>
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    const calls: Call[] = callsResult.data || [];
    const answeredCalls = calls.filter(c => c.status === 'ANSWERED' && c.waitTime !== undefined && c.billsec !== undefined);
    const missedCalls = calls.filter(c => c.status !== 'ANSWERED');

    const totalCalls = calls.length;

    // SLA Calculation
    const callsAnsweredWithinSla = answeredCalls.filter(c => c.waitTime! <= SLA_TARGET_SECONDS).length;
    const serviceLevel = answeredCalls.length > 0 ? (callsAnsweredWithinSla / answeredCalls.length) * 100 : 0;

    // Average Speed of Answer (ASA)
    const totalWaitTime = answeredCalls.reduce((acc, c) => acc + c.waitTime!, 0);
    const averageSpeedOfAnswer = answeredCalls.length > 0 ? totalWaitTime / answeredCalls.length : 0;

    // Average Handle Time (AHT)
    const totalHandleTime = answeredCalls.reduce((acc, c) => acc + c.billsec!, 0);
    const averageHandleTime = answeredCalls.length > 0 ? totalHandleTime / answeredCalls.length : 0;

    // Abandonment Rate
    const abandonmentRate = totalCalls > 0 ? (missedCalls.length / totalCalls) * 100 : 0;

    const userMap = new Map(users.filter(u => u.extension).map(u => [u.extension!, u.name]));

    const operatorPerformanceData = answeredCalls.reduce((acc, call) => {
        if (call.operatorExtension) {
            const name = userMap.get(call.operatorExtension) || `Ext. ${call.operatorExtension}`;
            if (!acc[name]) {
                acc[name] = { answered: 0, totalTalkTime: 0 };
            }
            acc[name].answered++;
            acc[name].totalTalkTime += call.billsec || 0;
        }
        return acc;
    }, {} as Record<string, { answered: number; totalTalkTime: number }>);
    
    const chartData = Object.entries(operatorPerformanceData).map(([name, data]) => ({
        operator: name,
        answered: data.answered,
        avgHandleTime: data.answered > 0 ? data.totalTalkTime / data.answered : 0
    })).sort((a,b) => b.answered - a.answered);
    

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}м ${secs.toString().padStart(2, '0')}с`;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">Аналитика</h1>
                    <p className="text-muted-foreground">Ключевые показатели эффективности колл-центра (за последние 24 часа)</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <AnalyticsKpiCard 
                    title="Уровень обслуживания (SLA)"
                    value={`${serviceLevel.toFixed(1)}%`}
                    description={`Отвечено за ${SLA_TARGET_SECONDS} сек.`}
                    trendValue="+2.1%"
                    trendDirection="up"
                />
                <AnalyticsKpiCard 
                    title="Среднее время ответа (ASA)"
                    value={formatTime(averageSpeedOfAnswer)}
                    description="Среднее время до ответа"
                    trendValue="-3.4%"
                    trendDirection="down"
                />
                <AnalyticsKpiCard 
                    title="Среднее время обработки (AHT)"
                    value={formatTime(averageHandleTime)}
                    description="Разговор + удержание"
                    trendValue="+1.2%"
                    trendDirection="up"
                />
                <AnalyticsKpiCard 
                    title="Процент потерянных"
                    value={`${abandonmentRate.toFixed(1)}%`}
                    description={`${missedCalls.length} из ${totalCalls} звонков`}
                    trendValue="-0.5%"
                    trendDirection="down"
                />
            </div>
            
            <div className="grid gap-6 lg:grid-cols-2">
                 <Card>
                    <CardHeader>
                        <CardTitle>Производительность операторов</CardTitle>
                        <CardDescription>
                            Количество отвеченных вызовов и среднее время обработки.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <OperatorPerformanceChart data={chartData} />
                    </CardContent>
                </Card>

                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-full">
                  <div className="flex flex-col items-center gap-1 text-center">
                     <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit mb-4">
                        <BarChart3 className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight">
                      Распределение звонков по очередям
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Этот график скоро появится.
                    </p>
                  </div>
                </div>
            </div>
        </div>
    );
}
