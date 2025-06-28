'use client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BarChart as BarChartIcon } from 'lucide-react';

interface ChartData {
    operator: string;
    answered: number;
    avgHandleTime: number;
}

interface OperatorPerformanceChartProps {
  data: ChartData[];
}

function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        const formatTime = (seconds: number) => {
            const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${minutes}м ${secs.toString().padStart(2, '0')}с`;
        };

        return (
            <div className="rounded-lg border bg-background p-2 shadow-sm">
                <p className="mb-1 font-bold">{label}</p>
                <p className="text-sm" style={{ color: payload[0].fill }}>
                    Отвечено: {payload[0].value}
                </p>
                <p className="text-sm" style={{ color: payload[1].fill }}>
                    Среднее время: {formatTime(payload[1].value)}
                </p>
            </div>
        );
    }
    return null;
}

export function OperatorPerformanceChart({ data }: OperatorPerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[350px] flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <BarChartIcon className="h-12 w-12 mx-auto mb-4" />
            <p className="font-semibold">Нет данных для отображения</p>
            <p className="text-sm">
              График появится после того, как операторы начнут отвечать на звонки.
            </p>
          </div>
      </div>
    );
  }

  return (
    <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
        <BarChart
            data={data}
            margin={{
            top: 5,
            right: 10,
            left: 10,
            bottom: 5,
            }}
        >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
                dataKey="operator" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
            />
            <YAxis
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
            />
             <YAxis
                yAxisId="right"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${Math.round(value / 60)}м`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{fontSize: "12px"}} />
            <Bar yAxisId="left" dataKey="answered" name="Отвечено" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="right" dataKey="avgHandleTime" name="Среднее время обработки" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
        </BarChart>
        </ResponsiveContainer>
    </div>
  );
}
