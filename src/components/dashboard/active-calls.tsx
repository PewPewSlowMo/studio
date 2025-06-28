'use client';
import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { AsteriskEndpoint, User } from '@/lib/types';
import { Phone, PhoneIncoming, PhoneOff } from 'lucide-react';

interface ActiveCallsProps {
  endpoints: AsteriskEndpoint[];
  users: User[];
}

const stateInfo: Record<
  string,
  {
    text: string;
    variant: 'default' | 'destructive' | 'secondary' | 'outline';
    icon: React.ElementType;
  }
> = {
  ringing: { text: 'Ringing', variant: 'default', icon: PhoneIncoming },
  'in use': { text: 'On Call', variant: 'secondary', icon: Phone },
  busy: { text: 'Busy', variant: 'destructive', icon: PhoneOff },
};

export function ActiveCalls({ endpoints, users }: ActiveCallsProps) {
  const userMap = useMemo(
    () => new Map(users.filter((u) => u.extension).map((u) => [u.extension, u])),
    [users]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Calls</CardTitle>
        <CardDescription>
          A real-time view of extensions that are currently active.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Extension</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {endpoints.length > 0 ? (
              endpoints.map((endpoint) => {
                const info =
                  stateInfo[endpoint.state.toLowerCase()] ||
                  stateInfo['in use'];
                const user = userMap.get(endpoint.resource);
                const name = user?.name || 'Unassigned';
                return (
                  <TableRow key={endpoint.resource}>
                    <TableCell>
                      <Badge variant={info.variant} className="capitalize">
                        <info.icon className="mr-2 h-4 w-4" />
                        {info.text}
                      </Badge>
                    </TableCell>
                    <TableCell>{name}</TableCell>
                    <TableCell>{endpoint.resource}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  No active calls at the moment.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
