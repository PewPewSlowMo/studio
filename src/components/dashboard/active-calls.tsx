'use client';
import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import type { Call, CallStatus } from '@/lib/types';
import { Phone, PhoneOff, PhoneIncoming, PhoneMissed } from 'lucide-react';

interface ActiveCallsProps {
  calls: Call[];
}

export function ActiveCalls({ calls: initialCalls }: ActiveCallsProps) {
  const [calls, setCalls] = useState(initialCalls);

  const handleAnswer = (callId: string) => {
    setCalls(
      calls.map((c) =>
        c.id === callId ? { ...c, status: 'answered' } : c
      )
    );
  };

  const handleHangup = (callId: string) => {
    setCalls(
      calls.map((c) =>
        c.id === callId ? { ...c, status: 'completed' } : c
      )
    );
  };

  const statusInfo: Record<
    CallStatus,
    {
      text: string;
      variant: 'default' | 'destructive' | 'secondary' | 'outline';
      icon: React.ElementType;
    }
  > = {
    incoming: { text: 'Incoming', variant: 'default', icon: PhoneIncoming },
    answered: { text: 'Answered', variant: 'secondary', icon: Phone },
    completed: { text: 'Completed', variant: 'outline', icon: PhoneOff },
    missed: { text: 'Missed', variant: 'destructive', icon: PhoneMissed },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Calls</CardTitle>
        <CardDescription>
          Calls currently being handled or waiting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.map((call) => {
              const info = statusInfo[call.status];
              return (
                <TableRow key={call.id}>
                  <TableCell>
                    <Badge variant={info.variant} className="capitalize">
                      <info.icon className="mr-2 h-4 w-4" />
                      {info.text}
                    </Badge>
                  </TableCell>
                  <TableCell>{call.callerNumber}</TableCell>
                  <TableCell>{call.operatorName || 'Unassigned'}</TableCell>
                  <TableCell>{call.duration ? `${call.duration}s` : '-'}</TableCell>
                  <TableCell className="text-right">
                    {call.status === 'incoming' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAnswer(call.id)}
                      >
                        <Phone className="mr-2 h-4 w-4" /> Answer
                      </Button>
                    )}
                    {call.status === 'answered' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleHangup(call.id)}
                      >
                        <PhoneOff className="mr-2 h-4 w-4" /> Hang Up
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
