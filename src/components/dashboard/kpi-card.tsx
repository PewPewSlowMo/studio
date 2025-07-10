import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  description: string;
  details?: { name: string; state?: string }[];
  detailsTitle?: string;
}

const stateConfig: Record<string, { label: string; colorClass: string }> = {
  'not in use': { label: 'Online', colorClass: 'bg-green-500' },
  'in use': { label: 'On Call', colorClass: 'bg-red-500' },
  busy: { label: 'Busy', colorClass: 'bg-red-500' },
  unavailable: { label: 'Offline', colorClass: 'bg-gray-400' },
  ringing: { label: 'Ringing', colorClass: 'bg-yellow-500' },
  invalid: { label: 'Invalid', colorClass: 'bg-gray-400' },
  unknown: { label: 'Unknown', colorClass: 'bg-gray-400' },
};

export function KpiCard({
  title,
  value,
  icon: Icon,
  description,
  details,
  detailsTitle,
}: KpiCardProps) {
  const cardContent = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  if (!details || details.length === 0) {
    return cardContent;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="cursor-pointer">{cardContent}</div>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">{detailsTitle}</h4>
            <p className="text-sm text-muted-foreground">
              Детальный список.
            </p>
          </div>
          <ScrollArea className="h-48">
            <div className="grid gap-2">
              {details.map((item) => {
                const status = item.state
                  ? stateConfig[item.state.toLowerCase()] ||
                    stateConfig['unknown']
                  : null;
                const fallback = item.name.slice(0, 2).toUpperCase();

                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between space-x-4 p-2 rounded-md hover:bg-muted"
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{fallback}</AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-medium leading-none">
                        {item.name}
                      </p>
                    </div>
                    {status ? (
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'h-2 w-2 rounded-full',
                            status.colorClass
                          )}
                        />
                        <span className="text-xs text-muted-foreground capitalize">
                          {status.label}
                        </span>
                      </div>
                    ) : (
                       item.state && <Badge variant="outline">{item.state}</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
