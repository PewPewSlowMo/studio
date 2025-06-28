import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold">Аналитика</h1>
                <p className="text-muted-foreground">Расширенные аналитические отчеты и дашборды</p>
            </div>
        </div>
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-96">
          <div className="flex flex-col items-center gap-1 text-center">
             <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit mb-4">
                <BarChart3 className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">
              Раздел в разработке
            </h3>
            <p className="text-sm text-muted-foreground">
              Этот функционал скоро появится.
            </p>
          </div>
        </div>
    </div>
  );
}
