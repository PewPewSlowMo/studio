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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Helper function to get connection details from environment variables
function getAmiConnection() {
  return {
    host: process.env.AMI_HOST || '',
    port: process.env.AMI_PORT || '',
    username: process.env.AMI_USERNAME || '',
    password: process.env.AMI_PASSWORD || '',
  };
}

export default async function DashboardPage() {
  const amiConnection = getAmiConnection();

  // Fetch all data in parallel
  const [endpointsResult, queuesResult, users] = await Promise.all([
    getAmiEndpoints(amiConnection),
    getAmiQueues(amiConnection),
    getUsers(),
  ]);

  if (!endpointsResult.success) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Could not connect to Asterisk</AlertTitle>
        <AlertDescription>
          <p>
            There was an error connecting to the Asterisk Management Interface
            (AMI). Please check your connection settings in the Admin page or
            your `.env` file.
          </p>
          <p className="mt-2 font-mono text-xs">
            Error: {endpointsResult.error}
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  const endpoints = endpointsResult.data || [];
  const queues = queuesResult.data || [];

  const operatorsOnCall = endpoints.filter(
    (e) => e.state === 'in use' || e.state === 'busy'
  ).length;
  const operatorsOnline = endpoints.filter(
    (e) => e.state !== 'unavailable'
  ).length;
  const totalOperators = endpoints.length;
  const totalQueues = queues.length;

  const activeCallEndpoints = endpoints.filter(
    (e) => e.state === 'in use' || e.state === 'busy' || e.state === 'ringing'
  );

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
          <CallVolumeChart />
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
