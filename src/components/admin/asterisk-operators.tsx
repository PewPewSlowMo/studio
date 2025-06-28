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
import { getAmiEndpoints } from '@/actions/ami';
import type { AsteriskEndpoint } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

interface AsteriskOperatorsProps {
  connection: {
    host: string;
    port: string;
    username: string;
    password: string;
  };
}

const stateColorMap: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
  'not in use': 'default',
  'in use': 'destructive',
  'busy': 'destructive',
  'unavailable': 'secondary',
  'ringing': 'default',
  'invalid': 'secondary',
  'unknown': 'secondary',
};

export function AsteriskOperators({ connection }: AsteriskOperatorsProps) {
  const [endpoints, setEndpoints] = useState<AsteriskEndpoint[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setEndpoints([]);
    
    const result = await getAmiEndpoints(connection);
    if (result.success && result.data) {
      setEndpoints(result.data);
    } else {
      setSyncError(result.error || 'An unknown error occurred during sync.');
    }
    
    setIsSyncing(false);
  };
  
  const getBadgeVariant = (state: string) => {
    return stateColorMap[state.toLowerCase()] || 'outline';
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Asterisk Operators (Endpoints)</CardTitle>
            <CardDescription>
              Live endpoint data from the Asterisk server. Click Sync to fetch the latest data.
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
                <TableHead>Resource</TableHead>
                <TableHead>Technology</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Active Channels</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isSyncing ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <div className="flex justify-center items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="text-muted-foreground">Syncing from Asterisk...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : endpoints.length > 0 ? (
                endpoints.map((endpoint) => (
                  <TableRow key={`${endpoint.technology}/${endpoint.resource}`}>
                    <TableCell className="font-medium">{endpoint.resource}</TableCell>
                    <TableCell>{endpoint.technology}</TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(endpoint.state)} className='capitalize'>{endpoint.state}</Badge>
                    </TableCell>
                    <TableCell>{endpoint.channel_ids.length}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No operator data. Click "Sync" to fetch from server.
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
