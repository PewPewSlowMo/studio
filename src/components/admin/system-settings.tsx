'use client';
import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface ConnectionProps {
    host: string;
    port: string;
    username: string;
    password: string;
}

interface OnChangeProps {
    setHost: (host: string) => void;
    setPort: (port: string) => void;
    setUsername: (username: string) => void;
    setPassword: (password: string) => void;
}

interface SystemSettingsProps {
  ariConnection: ConnectionProps;
  amiConnection: ConnectionProps;
  onAriChange: OnChangeProps;
  onAmiChange: OnChangeProps;
}

type InterfaceType = 'ami' | 'ari';

export function SystemSettings({ ariConnection, amiConnection, onAriChange, onAmiChange }: SystemSettingsProps) {
  const [interfaceType, setInterfaceType] = useState<InterfaceType>('ami');
  
  const connection = interfaceType === 'ami' ? amiConnection : ariConnection;
  const onConnectionChange = interfaceType === 'ami' ? onAmiChange : onAriChange;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
            <Link className="h-8 w-8 text-muted-foreground" />
            <div>
                <CardTitle>Конфигурация Asterisk</CardTitle>
                <CardDescription>
                Настройки подключения к серверу Asterisk PBX
                </CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
            <Label>Тип интерфейса</Label>
            <Select value={interfaceType} onValueChange={(value) => setInterfaceType(value as InterfaceType)}>
                <SelectTrigger>
                    <SelectValue placeholder="Выберите тип интерфейса" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ami">AMI (рекомендуется для колл-центра)</SelectItem>
                    <SelectItem value="ari">ARI (для расширенной разработки)</SelectItem>
                </SelectContent>
            </Select>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-1">
            <Button variant={interfaceType === 'ami' ? 'default' : 'ghost'} onClick={() => setInterfaceType('ami')} className="shadow-sm data-[state=active]:bg-background data-[state=active]:text-foreground" data-state={interfaceType === 'ami' ? 'active' : 'inactive'}>AMI Настройки</Button>
            <Button variant={interfaceType === 'ari' ? 'default' : 'ghost'} onClick={() => setInterfaceType('ari')} className="shadow-sm data-[state=active]:bg-background data-[state=active]:text-foreground" data-state={interfaceType === 'ari' ? 'active' : 'inactive'}>ARI Настройки</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
             <div className="space-y-2">
              <Label htmlFor="host">Хост</Label>
              <Input
                id="host"
                value={connection.host}
                onChange={(e) => onConnectionChange.setHost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">{interfaceType.toUpperCase()} Порт</Label>
              <Input
                id="port"
                type="number"
                value={connection.port}
                onChange={(e) => onConnectionChange.setPort(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">{interfaceType.toUpperCase()} Пользователь</Label>
              <Input
                id="username"
                value={connection.username}
                onChange={(e) => onConnectionChange.setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{interfaceType.toUpperCase()} Пароль</Label>
              <Input
                id="password"
                type="password"
                value={connection.password}
                onChange={(e) => onConnectionChange.setPassword(e.target.value)}
              />
            </div>
        </div>

        <Alert className={cn('bg-blue-50 border border-blue-200 text-blue-800', interfaceType === 'ari' && 'hidden')}>
            <AlertDescription>
                <span className='font-bold'>AMI преимущества:</span> Более стабильное подключение, нет проблем с HTTP/HTTPS, реальное время событий, лучше подходит для колл-центра.
            </AlertDescription>
        </Alert>

      </CardContent>
      <CardFooter className="border-t bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
            <Switch id="asterisk-enabled" defaultChecked />
            <Label htmlFor="asterisk-enabled">Включить интеграцию с Asterisk</Label>
        </div>
      </CardFooter>
    </Card>
  );
}
