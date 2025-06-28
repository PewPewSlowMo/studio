'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface ConnectionStatusCardProps {
  icon: LucideIcon;
  title: string;
  status: 'Unknown' | 'Connected' | 'Failed';
  port: string;
  onTest: () => void;
  isTesting: boolean;
  variant?: 'default' | 'success';
}

const statusMap: Record<ConnectionStatusCardProps['status'], { text: string, variant: 'secondary' | 'success' | 'destructive' }> = {
    Unknown: { text: 'Неизвестно', variant: 'secondary' },
    Connected: { text: 'Подключено', variant: 'success' },
    Failed: { text: 'Ошибка', variant: 'destructive' },
}

export function ConnectionStatusCard({
  icon: Icon,
  title,
  status,
  port,
  onTest,
  isTesting,
  variant = 'default',
}: ConnectionStatusCardProps) {
    const statusInfo = statusMap[status];

  return (
    <Card className={cn(variant === 'success' && 'border-green-500 bg-green-500/5')}>
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Icon className={cn('h-6 w-6', variant === 'success' ? 'text-green-600' : 'text-muted-foreground')} />
            <h3 className="font-semibold">{title}</h3>
          </div>
          <Badge variant={statusInfo.variant} className="capitalize">{statusInfo.text}</Badge>
        </div>
        <div className="flex items-baseline justify-between text-sm text-muted-foreground mb-4">
          <span>Порт:</span>
          <span className="font-mono text-foreground">{port}</span>
        </div>
        <div className="mt-auto">
            <Button onClick={onTest} disabled={isTesting} className={cn("w-full", variant === 'success' ? 'bg-green-600 hover:bg-green-700 text-white' : '')}>
            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isTesting ? 'Проверка...' : `Тест ${title.split(' ')[0]}`}
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
