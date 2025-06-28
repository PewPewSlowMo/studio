'use client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { AlertTriangle, BarChart as BarChartIcon } from 'lucide-react';

interface CallVolumeChartProps {
  data: { hour: string; calls: number }[] | null;
}

export function CallVolumeChart({ data }: CallVolumeChartProps) {
  if (!data) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Call Volume</CardTitle>
          <CardDescription>Calls per hour over the last 24 hours.</CardDescription>
        </CardHeader>
        <CardContent className="pl-2 h-[300px] flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <p className="font-semibold">Could not load call volume data.</p>
            <p className="text-sm">
              Please check the CDR database connection in Admin settings.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.every((d) => d.calls === 0)) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Call Volume</CardTitle>
          <CardDescription>Calls per hour over the last 24 hours.</CardDescription>
        </CardHeader>
        <CardContent className="pl-2 h-[300px] flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <BarChartIcon className="h-12 w-12 mx-auto mb-4" />
            <p className="font-semibold">No call data for the last 24 hours.</p>
            <p className="text-sm">
              The chart will populate once calls are made.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Call Volume</CardTitle>
        <CardDescription>Calls per hour over the last 24 hours.</CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="hour"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={30}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--accent))', opacity: 0.5 }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
                borderRadius: 'var(--radius)',
              }}
            />
            <Bar
              dataKey="calls"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
