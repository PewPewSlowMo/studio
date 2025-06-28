'use client';
import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { getAsteriskVersion } from '@/actions/asterisk';
import { Loader2, Server, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SystemSettingsProps {
  connection: {
    host: string;
    port: string;
    username: string;
    password: string;
  };
  onConnectionChange: {
    setHost: (host: string) => void;
    setPort: (port: string) => void;
    setUsername: (username: string) => void;
    setPassword: (password: string) => void;
  };
}

export function SystemSettings({ connection, onConnectionChange }: SystemSettingsProps) {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    version?: string;
    error?: string;
  } | null>(null);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionResult(null);
    const result = await getAsteriskVersion(connection);
    if (result.success) {
      setConnectionResult({ version: result.version });
      toast({
        title: 'Connection Successful',
        description: `Connected to Asterisk version: ${result.version}`,
      });
    } else {
      setConnectionResult({ error: result.error });
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: result.error,
        duration: 9000,
      });
    }
    setIsTesting(false);
  };

  const handleSave = () => {
    toast({
      title: 'Settings Saved',
      description: 'Your Asterisk configuration has been saved.',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Settings</CardTitle>
        <CardDescription>
          Configure Asterisk integration and other system parameters.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Asterisk Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={connection.host}
                onChange={(e) => onConnectionChange.setHost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={connection.port}
                onChange={(e) => onConnectionChange.setPort(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={connection.username}
                onChange={(e) => onConnectionChange.setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={connection.password}
                onChange={(e) => onConnectionChange.setPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-4">
            <Switch id="asterisk-enabled" defaultChecked />
            <Label htmlFor="asterisk-enabled">Enable Asterisk Integration</Label>
          </div>
        </div>
        {connectionResult && (
          <div className="mt-4">
            {connectionResult.version && (
              <Alert>
                <Server className="h-4 w-4" />
                <AlertTitle>Connection Successful!</AlertTitle>
                <AlertDescription>
                  Successfully connected to Asterisk version:{' '}
                  <strong>{connectionResult.version}</strong>
                </AlertDescription>
              </Alert>
            )}
            {connectionResult.error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Connection Failed</AlertTitle>
                <AlertDescription>{connectionResult.error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
        <Separator />
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Call Settings</h3>
          <div className="flex items-center space-x-2">
            <Switch id="call-recording" defaultChecked />
            <Label htmlFor="call-recording">Enable Call Recording</Label>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t bg-secondary/50 px-6 py-4">
        <div className="flex gap-2">
          <Button onClick={handleSave}>Save Settings</Button>
          <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Connection
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
