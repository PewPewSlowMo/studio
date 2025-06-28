import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface MissedCallKpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
}

export function MissedCallKpiCard({ title, value, icon: Icon }: MissedCallKpiCardProps) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
      </CardContent>
    </Card>
  );
}
