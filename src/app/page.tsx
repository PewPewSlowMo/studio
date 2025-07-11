'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Phone,
  PhoneCall,
  Users,
  AlertTriangle,
  PhoneForwarded,
  Presentation,
} from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { CallVolumeChart } from '@/components/dashboard/call-volume-chart';
import { OperatorStatusList } from '@/components/dashboard/operator-status';
import { ActiveCallsTable } from '@/components/dashboard/active-calls';
import { getAmiEndpoints, getAmiQueues } from '@/actions/ami';
import { getUsers } from '@/actions/users';
import { getConfig } from '@/actions/config';
import { getCallHistory, type DateRangeParams } from '@/actions/cdr';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isValid, subHours, subDays } from 'date-fns';
import type { Call, User, AsteriskEndpoint, AsteriskQueue, CallState } from '@/lib/types';
import { getOperatorState } from '@/actions/asterisk';
import { initializeDatabase } from '@/actions/app-db';

function KpiCardSkeleton() {
  return (
    <div className="p-6 border rounded-lg shadow-sm bg-card">
      <div className="flex flex-row items-center justify-between pb-2 space-y-0">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </div>
      <div>
        <Skeleton className="h-8 w-12 mt-1" />
        <Skeleton className="h-3 w-40 mt-2" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    endpoints: AsteriskEndpoint[];
    queues: AsteriskQueue[];
    users: User[];
    calls: Call[];
  } | null>(null);
  const [liveChannels, setLiveChannels] = useState<CallState[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await initializeDatabase();
        
        const config = await getConfig();
        const dateRange: DateRangeParams = { 
            from: subDays(new Date(), 1).toISOString(), 
            to: new Date().toISOString() 
        };

        const [endpointsResult, queuesResult, users, callsResult] = await Promise.all([
          getAmiEndpoints(config.ami),
          getAmiQueues(config.ami),
          getUsers(),
          getCallHistory(config.cdr, dateRange),
        ]);

        if (!endpointsResult.success) throw new Error(endpointsResult.error || 'Failed to fetch endpoints');
        if (!queuesResult.success) throw new Error(queuesResult.error || 'Failed to fetch queues');
        if (!callsResult.success) throw new Error(callsResult.error || 'Failed to fetch call history');
        
        setData({
          endpoints: endpointsResult.data || [],
          queues: queuesResult.data || [],
          users: users,
          calls: callsResult.data || [],
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);
  
  useEffect(() => {
    if (!data?.users || !data.users.length) return;
  
    const pollStates = async () => {
      try {
        const operatorExtensions = data.users
          .filter(u => u.role === 'operator' && u.extension)
          .map(u => u.extension!);
  
        const statePromises = operatorExtensions.map(ext => 
          getOperatorState(ext).then(res => 
            res.success && res.data ? { ...res.data, extension: ext } as CallState & { extension: string } : null
          )
        );
        const results = await Promise.all(statePromises);
        const activeStatuses = ['on-call', 'ringing', 'busy', 'in use'];
        const activeChannels = results.filter(r => r && activeStatuses.includes(r.endpointState)) as (CallState & { extension: string })[];
        setLiveChannels(activeChannels as CallState[]);
        
      } catch (error) {
        console.error("Error polling operator states:", error);
      }
    };
  
    const interval = setInterval(pollStates, 3000);
    return () => clearInterval(interval);
  }, [data?.users]);


  const dashboardData = useMemo(() => {
    if (!data) return null;

    const { endpoints, queues, users, calls } = data;
    
    const userMap = new Map(users.filter((u) => u.extension).map((u) => [u.extension!, u]));

    const callVolumeData = Array.from({ length: 24 }, (_, i) => {
      const d = new Date();
      d.setHours(d.getHours() - i);
      return {
        hour: format(new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()), 'HH:00'),
        calls: 0,
      };
    }).reverse();

    const hourlyMap = new Map(callVolumeData.map((d) => [d.hour, d]));
    calls.forEach((call) => {
      const callDate = parseISO(call.startTime);
      if (isValid(callDate)) {
        const callHour = format(callDate, 'HH:00');
        if (hourlyMap.has(callHour)) {
          hourlyMap.get(callHour)!.calls++;
        }
      }
    });

    const operatorsOnline = endpoints.filter((e) => e.state !== 'unavailable' && e.state !== 'invalid').length;
    const totalOperators = users.filter(u => u.role === 'operator').length;
    
    const oneHourAgo = subHours(new Date(), 1);
    const recentCalls = calls.filter(c => parseISO(c.startTime) >= oneHourAgo);
    
    const queueDetails = queues.map(queue => {
      const queueCalls = recentCalls.filter(c => c.queue === queue.name);
      return {
        name: queue.name,
        state: `${queueCalls.length} за час`,
      };
    }).sort((a,b) => a.name.localeCompare(b.name));

    const operatorDetails = users.filter(u => u.role === 'operator').map(user => {
        const endpoint = endpoints.find(e => e.resource === user.extension);
        return {
            name: user.name || `Внутренний ${user.extension}`,
            state: endpoint?.state || 'unavailable',
        }
    }).sort((a, b) => a.name.localeCompare(b.name));

    const onlineOperatorDetails = operatorDetails.filter(op => op.state !== 'unavailable' && op.state !== 'invalid');
    
    const onCallOperatorDetails = operatorDetails.filter(op => ['in use', 'busy', 'ringing'].includes(op.state));
    
    const operatorsOnCall = onCallOperatorDetails.length;

    const enrichedLiveCalls = liveChannels.map(channel => ({
      ...channel,
      status: channel.endpointState!,
      operatorName: userMap.get(channel.extension!)?.name || `Ext. ${channel.extension}`
    }));


    return {
      callVolumeChartData: Array.from(hourlyMap.values()),
      operatorsOnCall,
      operatorsOnline,
      totalOperators,
      totalQueues: queues.length,
      queueDetails,
      operatorDetails,
      onlineOperatorDetails,
      onCallOperatorDetails,
      enrichedLiveCalls,
      totalCallsLastHour: recentCalls.length
    };
  }, [data, liveChannels]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить дашборд</AlertTitle>
        <AlertDescription>
          <p>Произошла ошибка при получении данных, необходимых для дашборда.</p>
          <p className="mt-2 font-mono text-xs">Ошибка: {error}</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading || !dashboardData) {
    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <Skeleton className="h-[380px] w-full" />
                </div>
                <div className="lg:col-span-1">
                    <Skeleton className="h-[380px] w-full" />
                </div>
            </div>
            <div>
                 <Skeleton className="h-[200px] w-full" />
            </div>
        </div>
    );
  }
  
  const {
      callVolumeChartData,
      operatorsOnCall,
      operatorsOnline,
      totalOperators,
      totalQueues,
      queueDetails,
      operatorDetails,
      onlineOperatorDetails,
      onCallOperatorDetails,
      enrichedLiveCalls,
      totalCallsLastHour
  } = dashboardData;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Всего операторов"
          value={totalOperators.toString()}
          icon={Users}
          description="Все настроенные пользователи-операторы."
          detailsTitle="Все операторы"
          details={operatorDetails}
        />
        <KpiCard
          title="Операторы онлайн"
          value={operatorsOnline.toString()}
          icon={PhoneForwarded}
          description="Операторы не в статусе 'недоступен'."
          detailsTitle="Операторы онлайн"
          details={onlineOperatorDetails}
        />
        <KpiCard
          title="В разговоре"
          value={operatorsOnCall.toString()}
          icon={Phone}
          description="Операторы в статусе 'занят' или 'разговор'."
          detailsTitle="Операторы на линии"
          details={onCallOperatorDetails}
        />
        <KpiCard
          title="Активные очереди"
          value={totalQueues.toString()}
          icon={Presentation}
          description="Всего настроенных очередей."
          detailsTitle="Звонки по очередям (за час)"
          details={queueDetails}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CallVolumeChart data={callVolumeChartData} liveCalls={enrichedLiveCalls.length} />
        </div>
        <div className="lg:col-span-1">
          <OperatorStatusList users={data.users} endpoints={data.endpoints} />
        </div>
      </div>
      <div>
        <ActiveCallsTable liveCalls={enrichedLiveCalls} />
      </div>
    </div>
  );
}
