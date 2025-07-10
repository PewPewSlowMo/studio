import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { AsteriskEndpoint, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface OperatorStatusListProps {
  endpoints: AsteriskEndpoint[];
  users: User[];
}

const stateConfig: Record<string, { label: string; colorClass: string }> = {
  'not in use': { label: 'Готов к работе', colorClass: 'bg-green-500' },
  'ringing': { label: 'В разговоре', colorClass: 'bg-yellow-500' },
  'in use': { label: 'В разговоре', colorClass: 'bg-yellow-500' },
  'busy': { label: 'В разговоре', colorClass: 'bg-yellow-500' },
  'away': { label: 'Отошел', colorClass: 'bg-blue-500' },
  'dnd': { label: 'Не беспокоить', colorClass: 'bg-orange-500' },
  'unavailable': { label: 'Оффлайн', colorClass: 'bg-red-500' },
  'invalid': { label: 'Оффлайн', colorClass: 'bg-red-500' },
  'unknown': { label: 'Неизвестно', colorClass: 'bg-gray-400' },
};

export function OperatorStatusList({ endpoints, users }: OperatorStatusListProps) {
  const userMap = useMemo(() => 
    new Map(users.filter(u => u.extension).map(u => [u.extension, u]))
  , [users]);

  const operatorDetails = useMemo(() => {
    return users
      .filter(user => user.role === 'operator' && user.extension)
      .map(user => {
        const endpoint = endpoints.find(e => e.resource === user.extension);
        const state = endpoint?.state.toLowerCase() || 'unavailable';
        return {
          name: user.name,
          extension: user.extension!,
          status: stateConfig[state] || stateConfig.unknown,
          fallback: user.name.slice(0, 2).toUpperCase()
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, endpoints]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Статус операторов</CardTitle>
        <CardDescription>Состояние операторов в реальном времени.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {operatorDetails.map((op) => (
          <div key={op.extension} className="flex items-center space-x-4">
            <Avatar>
              <AvatarImage src={`https://placehold.co/100x100.png`} data-ai-hint="user avatar" />
              <AvatarFallback>{op.fallback}</AvatarFallback>
            </Avatar>
            <div className="flex-grow">
              <p className="text-sm font-medium leading-none">{op.name}</p>
              <p className="text-sm text-muted-foreground">
                Вн. {op.extension}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn('h-2 w-2 rounded-full', op.status.colorClass)} />
              <span className="text-sm text-muted-foreground capitalize">
                {op.status.label}
              </span>
            </div>
          </div>
        ))}
        {operatorDetails.length === 0 && (
          <div className="text-center text-muted-foreground py-4">
            Операторы не найдены.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
