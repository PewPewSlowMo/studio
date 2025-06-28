import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { AsteriskEndpoint, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface OperatorStatusListProps {
  endpoints: AsteriskEndpoint[];
  users: User[];
}

const stateConfig: Record<
  string,
  { label: string; colorClass: string }
> = {
  'not in use': { label: 'Online', colorClass: 'bg-green-500' },
  'in use': { label: 'On Call', colorClass: 'bg-red-500' },
  busy: { label: 'Busy', colorClass: 'bg-red-500' },
  unavailable: { label: 'Offline', colorClass: 'bg-gray-400' },
  ringing: { label: 'Ringing', colorClass: 'bg-yellow-500' },
  invalid: { label: 'Invalid', colorClass: 'bg-gray-400' },
  unknown: { label: 'Unknown', colorClass: 'bg-gray-400' },
};


export function OperatorStatusList({ endpoints, users }: OperatorStatusListProps) {

  const userMap = useMemo(() => 
    new Map(users.filter(u => u.extension).map(u => [u.extension, u]))
  , [users]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operator Status</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {endpoints.map((endpoint) => {
          const user = userMap.get(endpoint.resource);
          const name = user?.name || `Extension ${endpoint.resource}`;
          const fallback = name.slice(0, 2).toUpperCase();
          const status = stateConfig[endpoint.state.toLowerCase()] || stateConfig['unknown'];

          return (
            <div
              key={endpoint.resource}
              className="flex items-center space-x-4"
            >
              <Avatar>
                <AvatarImage src={user ? `https://placehold.co/100x100.png` : undefined} data-ai-hint="user avatar" />
                <AvatarFallback>
                  {fallback}
                </AvatarFallback>
              </Avatar>
              <div className="flex-grow">
                <p className="text-sm font-medium leading-none">{name}</p>
                <p className="text-sm text-muted-foreground">
                  Ext: {endpoint.resource}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'h-2 w-2 rounded-full',
                    status.colorClass
                  )}
                />
                <span className="text-sm text-muted-foreground capitalize">
                  {status.label}
                </span>
              </div>
            </div>
          );
        })}
        {endpoints.length === 0 && (
          <div className="text-center text-muted-foreground py-4">
            No operators found.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
