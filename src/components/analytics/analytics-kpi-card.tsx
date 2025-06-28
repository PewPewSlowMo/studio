import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsKpiCardProps {
  title: string;
  value: string;
  description: string;
  trendValue: string;
  trendDirection: 'up' | 'down' | 'neutral';
}

export function AnalyticsKpiCard({ title, value, description, trendValue, trendDirection }: AnalyticsKpiCardProps) {
  const trendIcon = trendDirection === 'up' 
    ? <TrendingUp className="h-4 w-4 text-emerald-500" /> 
    : trendDirection === 'down' 
    ? <TrendingDown className="h-4 w-4 text-red-500" />
    : <Minus className="h-4 w-4 text-muted-foreground" />;
    
  const trendColor = trendDirection === 'up' 
    ? 'text-emerald-500' 
    : trendDirection === 'down' 
    ? 'text-red-500'
    : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        <div className="mt-4 flex items-center gap-1 text-xs">
            {trendIcon}
            <span className={cn(trendColor)}>{trendValue}</span>
            <span className="text-muted-foreground">vs прошлый период</span>
        </div>
      </CardContent>
    </Card>
  );
}
