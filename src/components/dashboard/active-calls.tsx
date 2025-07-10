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
import type { CallState } from '@/lib/types';
import { PhoneIncoming, PhoneCall, Phone, AlertCircle } from 'lucide-react';

interface ActiveCallsTableProps {
  liveCalls: (CallState & { operatorName: string })[];
}

const stateInfo: Record<
  string,
  {
    text: string;
    variant: 'default' | 'success' | 'destructive';
    icon: React.ElementType;
  }
> = {
  ringing: { text: 'Входящий', variant: 'default', icon: PhoneIncoming },
  'on-call': { text: 'В разговоре', variant: 'success', icon: PhoneCall },
  busy: { text: 'В разговоре', variant: 'success', icon: PhoneCall },
  'in use': { text: 'В разговоре', variant: 'success', icon: PhoneCall },
  default: { text: 'Неизвестно', variant: 'destructive', icon: AlertCircle },
};

export function ActiveCallsTable({ liveCalls }: ActiveCallsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Активные разговоры</CardTitle>
        <CardDescription>
          Обзор звонков, которые происходят прямо сейчас.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Статус</TableHead>
              <TableHead>Оператор</TableHead>
              <TableHead>Номер звонящего</TableHead>
              <TableHead>Очередь</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liveCalls.length > 0 ? (
              liveCalls.map((call) => {
                const info = stateInfo[call.status] || stateInfo['default'];
                return (
                  <TableRow key={call.uniqueId}>
                    <TableCell>
                      <Badge variant={info.variant} className="capitalize">
                        <info.icon className="mr-2 h-4 w-4" />
                        {info.text}
                      </Badge>
                    </TableCell>
                    <TableCell>{call.operatorName}</TableCell>
                    <TableCell>{call.callerId}</TableCell>
                    <TableCell>{call.queue || 'N/A'}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Нет активных разговоров.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
