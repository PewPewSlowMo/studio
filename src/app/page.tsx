'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Phone,
  PhoneForwarded,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { CallVolumeChart } from '@/components/dashboard/call-volume-chart';
import { OperatorStatusList } from '@/components/dashboard/operator-status';
import { ActiveCalls } from '@/components/dashboard/active-calls';
import { getAmiEndpoints, getAmiQueues } from '@/actions/ami';
import { getUsers } from '@/actions/users';
import { getConfig } from '@/actions/config';
import { getCallHistory } from '@/actions/cdr';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isValid } from 'date-fns';
import type { Call, User, AsteriskEndpoint, AsteriskQueue } from '@/lib/types';

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

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const config = await getConfig();
        const [endpointsResult, queuesResult, users, callsResult] = await Promise.all([
          getAmiEndpoints(config.ami),
          getAmiQueues(config.ami),
          getUsers(),
          getCallHistory(config.cdr),
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

  const dashboardData = useMemo(() => {
    if (!data) return null;

    const { endpoints, queues, users, calls } = data;

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

    const operatorsOnCall = endpoints.filter((e) => e.state === 'in use' || e.state === 'busy').length;
    const operatorsOnline = endpoints.filter((e) => e.state !== 'unavailable').length;
    const totalOperators = endpoints.length;
    const totalQueues = queues.length;
    const activeCallEndpoints = endpoints.filter((e) => e.state === 'in use' || e.state === 'busy' || e.state === 'ringing');

    return {
      callVolumeChartData: Array.from(hourlyMap.values()),
      operatorsOnCall,
      operatorsOnline,
      totalOperators,
      totalQueues,
      activeCallEndpoints,
      endpoints,
      users,
    };
  }, [data]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Could not load Dashboard</AlertTitle>
        <AlertDescription>
          <p>There was an error fetching the data needed for the dashboard.</p>
          <p className="mt-2 font-mono text-xs">Error: {error}</p>
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
      activeCallEndpoints,
      endpoints,
      users
  } = dashboardData;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Operators"
          value={totalOperators.toString()}
          icon={Users}
          description="All configured PJSIP endpoints."
        />
        <KpiCard
          title="Operators Online"
          value={operatorsOnline.toString()}
          icon={PhoneForwarded}
          description="Operators not in 'unavailable' state."
        />
        <KpiCard
          title="Operators on Call"
          value={operatorsOnCall.toString()}
          icon={Phone}
          description="Operators in 'in use' or 'busy' state."
        />
        <KpiCard
          title="Active Queues"
          value={totalQueues.toString()}
          icon={LayoutDashboard}
          description="Total configured call queues."
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CallVolumeChart data={callVolumeChartData} />
        </div>
        <div className="lg:col-span-1">
          <OperatorStatusList endpoints={endpoints} users={users} />
        </div>
      </div>
      <div>
        <ActiveCalls endpoints={activeCallEndpoints} users={users} />
      </div>
    </div>
  );
}