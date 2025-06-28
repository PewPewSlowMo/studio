'use client';
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

export function SystemSettings() {
  const { toast } = useToast();

  const handleTestConnection = () => {
    toast({
      title: 'Connection Successful',
      description: 'Successfully connected to 92.46.62.34:8088.',
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
              <Input id="host" defaultValue="92.46.62.34" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input id="port" type="number" defaultValue="8088" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" defaultValue="smart-call-center" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                defaultValue="Almaty20252025"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-4">
            <Switch id="asterisk-enabled" defaultChecked />
            <Label htmlFor="asterisk-enabled">Enable Asterisk Integration</Label>
          </div>
        </div>
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
          <Button>Save Settings</Button>
          <Button variant="outline" onClick={handleTestConnection}>
            Test Connection
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
