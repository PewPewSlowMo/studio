import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Phone } from 'lucide-react';

export default function QueueReportsPage() {
  return (
    <div className="space-y-6">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold">Отчет по очередям</h1>
                <p className="text-muted-foreground">Детальная аналитика по очередям вызовов</p>
            </div>
        </div>
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm h-96">
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit mb-4">
                <Phone className="h-8 w-8" />
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
