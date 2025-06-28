import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Operator, OperatorStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

interface OperatorStatusListProps {
  operators: Operator[];
}

export function OperatorStatusList({ operators }: OperatorStatusListProps) {
  const statusConfig: Record<
    OperatorStatus,
    { label: string; colorClass: string }
  > = {
    online: { label: 'Online', colorClass: 'bg-green-500' },
    busy: { label: 'Busy', colorClass: 'bg-red-500' },
    offline: { label: 'Offline', colorClass: 'bg-gray-400' },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operator Status</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {operators.map((operator) => (
          <div
            key={operator.id}
            className="flex items-center space-x-4"
          >
            <Avatar>
              <AvatarImage src="https://placehold.co/100x100.png" data-ai-hint="user avatar" />
              <AvatarFallback>
                {operator.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-grow">
              <p className="text-sm font-medium leading-none">{operator.name}</p>
              <p className="text-sm text-muted-foreground">
                Ext: {operator.extension}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  statusConfig[operator.status].colorClass
                )}
              />
              <span className="text-sm text-muted-foreground">
                {statusConfig[operator.status].label}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
