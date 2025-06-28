'use client';
import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getAsteriskQueues } from '@/actions/asterisk';
import type { AsteriskQueue } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AsteriskQueuesProps {
  connection: {
    host: string;
    port: string;
    username: string;
    password: string;
  };
}

export function AsteriskQueues({ connection }: AsteriskQueuesProps) {
  const [queues, setQueues] = useState<AsteriskQueue[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setQueues([]);
    const result = await getAsteriskQueues(connection);
    if (result.success && result.data) {
      setQueues(result.data);
    } else {
      setSyncError(result.error || 'An unknown error occurred during sync.');
    }
    setIsSyncing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Asterisk Queues</CardTitle>
            <CardDescription>
              Live queue data from the Asterisk server. Click Sync to fetch the latest data.
            </CardDescription>
          </div>
          <Button onClick={handleSync} disabled={isSyncing}>
            <RefreshCw
              className={cn('mr-2 h-4 w-4', isSyncing && 'animate-spin')}
            />
            Sync
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {syncError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sync Failed</AlertTitle>
            <AlertDescription>{syncError}</AlertDescription>
          </Alert>
        )}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Queue Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isSyncing ? (
                <TableRow>
                  <TableCell colSpan={1} className="h-24 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">Syncing from Asterisk...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : queues.length > 0 ? (
                queues.map((queue) => (
                  <TableRow key={queue.name}>
                    <TableCell className="font-medium">{queue.name}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={1} className="h-24 text-center">
                    No queue data. Click "Sync" to fetch from server.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
