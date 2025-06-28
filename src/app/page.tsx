import { KpiCard } from '@/components/dashboard/kpi-card';
import { CallVolumeChart } from '@/components/dashboard/call-volume-chart';
import { OperatorStatusList } from '@/components/dashboard/operator-status';
import { ActiveCalls } from '@/components/dashboard/active-calls';
import {
  LayoutDashboard,
  PhoneForwarded,
  PhoneMissed,
  Clock,
} from 'lucide-react';
import { mockOperators, mockCalls } from '@/lib/mock-data';

export default function DashboardPage() {
  const answeredCalls = mockCalls.filter(
    (c) => c.status === 'answered' || c.status === 'completed'
  ).length;
  const missedCalls = mockCalls.filter((c) => c.status === 'missed').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Calls Today" value="156" icon={LayoutDashboard} />
        <KpiCard
          title="Answered"
          value={answeredCalls.toString()}
          icon={PhoneForwarded}
        />
        <KpiCard
          title="Missed"
          value={missedCalls.toString()}
          icon={PhoneMissed}
        />
        <KpiCard title="Avg. Wait Time" value="45s" icon={Clock} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CallVolumeChart />
        </div>
        <div className="lg:col-span-1">
          <OperatorStatusList operators={mockOperators} />
        </div>
      </div>
      <div>
        <ActiveCalls
          calls={mockCalls.filter(
            (c) => c.status === 'answered' || c.status === 'incoming'
          )}
        />
      </div>
    </div>
  );
}
