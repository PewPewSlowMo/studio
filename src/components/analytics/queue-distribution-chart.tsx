'use client';
import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

interface ChartData {
    name: string;
    value: number;
}

interface QueueDistributionChartProps {
  data: ChartData[];
}

const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--accent))'
];

export function QueueDistributionChart({ data }: QueueDistributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[350px] flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4" />
            <p className="font-semibold">Нет данных для отображения</p>
            <p className="text-sm">
              График появится после того, как звонки начнут поступать в очереди.
            </p>
          </div>
      </div>
    );
  }

  return (
    <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Tooltip
                    cursor={{ fill: 'hsl(var(--accent))', opacity: 0.1 }}
                    contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                    }}
                />
                <Legend iconType="circle" />
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                        const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

                        if ((percent * 100) < 5) return null; // Do not render label for small slices

                        return (
                            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold">
                                {`${(percent * 100).toFixed(0)}%`}
                            </text>
                        );
                    }}
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
            </PieChart>
        </ResponsiveContainer>
    </div>
  );
}
