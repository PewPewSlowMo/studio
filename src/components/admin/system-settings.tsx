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
import { Wifi, Database, Loader2, Server } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

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

interface DbConnectionProps extends ConnectionProps {
    database: string;
}

interface OnDbChangeProps extends OnChangeProps {
    setDatabase: (database: string) => void;
}

interface SystemSettingsProps {
  amiConnection: ConnectionProps;
  cdrConnection: DbConnectionProps;
  appDbConnection: DbConnectionProps;
  onAmiChange: OnChangeProps;
  onCdrChange: OnDbChangeProps;
  onAppDbChange: OnDbChangeProps;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

export function SystemSettings({ amiConnection, cdrConnection, appDbConnection, onAmiChange, onCdrChange, onAppDbChange, onSave, isSaving }: SystemSettingsProps) {

  return (
    <Card>
      <CardHeader>
        <CardTitle>Конфигурация подключений</CardTitle>
        <CardDescription>
        Настройки для подключения к Asterisk и базам данных.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* AMI Settings */}
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <Wifi className="h-8 w-8 text-muted-foreground" />
                <div>
                    <h3 className="text-lg font-semibold">Asterisk Manager Interface (AMI)</h3>
                    <p className="text-sm text-muted-foreground">Для управления и мониторинга Asterisk в реальном времени.</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                <Label htmlFor="ami-host">Хост</Label>
                <Input id="ami-host" value={amiConnection.host} onChange={(e) => onAmiChange.setHost(e.target.value)} />
                </div>
                <div className="space-y-2">
                <Label htmlFor="ami-port">Порт</Label>
                <Input id="ami-port" type="number" value={amiConnection.port} onChange={(e) => onAmiChange.setPort(e.target.value)} />
                </div>
                <div className="space-y-2">
                <Label htmlFor="ami-username">Пользователь</Label>
                <Input id="ami-username" value={amiConnection.username} onChange={(e) => onAmiChange.setUsername(e.target.value)} />
                </div>
                <div className="space-y-2">
                <Label htmlFor="ami-password">Пароль</Label>
                <Input id="ami-password" type="password" value={amiConnection.password} onChange={(e) => onAmiChange.setPassword(e.target.value)} />
                </div>
            </div>
        </div>
        
        <Separator />
        
        {/* CDR DB Settings */}
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <Database className="h-8 w-8 text-muted-foreground" />
                <div>
                    <h3 className="text-lg font-semibold">База данных CDR</h3>
                    <p className="text-sm text-muted-foreground">Подключение к базе данных истории звонков (Call Detail Record).</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                    <Label htmlFor="cdr-host">Хост</Label>
                    <Input id="cdr-host" value={cdrConnection.host} onChange={(e) => onCdrChange.setHost(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cdr-port">Порт</Label>
                    <Input id="cdr-port" type="number" value={cdrConnection.port} onChange={(e) => onCdrChange.setPort(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cdr-username">Пользователь</Label>
                    <Input id="cdr-username" value={cdrConnection.username} onChange={(e) => onCdrChange.setUsername(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cdr-password">Пароль</Label>
                    <Input id="cdr-password" type="password" value={cdrConnection.password} onChange={(e) => onCdrChange.setPassword(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="cdr-database">Имя базы данных</Label>
                    <Input id="cdr-database" value={cdrConnection.database} onChange={(e) => onCdrChange.setDatabase(e.target.value)} />
                </div>
            </div>
        </div>

        <Separator />

        {/* App DB Settings */}
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <Server className="h-8 w-8 text-muted-foreground" />
                <div>
                    <h3 className="text-lg font-semibold">База данных приложения</h3>
                    <p className="text-sm text-muted-foreground">База для хранения пользователей, CRM, обращений и других данных приложения.</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                    <Label htmlFor="appdb-host">Хост</Label>
                    <Input id="appdb-host" value={appDbConnection.host} onChange={(e) => onAppDbChange.setHost(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="appdb-port">Порт</Label>
                    <Input id="appdb-port" type="number" value={appDbConnection.port} onChange={(e) => onAppDbChange.setPort(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="appdb-username">Пользователь</Label>
                    <Input id="appdb-username" value={appDbConnection.username} onChange={(e) => onAppDbChange.setUsername(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="appdb-password">Пароль</Label>
                    <Input id="appdb-password" type="password" value={appDbConnection.password} onChange={(e) => onAppDbChange.setPassword(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="appdb-database">Имя базы данных</Label>
                    <Input id="appdb-database" value={appDbConnection.database} onChange={(e) => onAppDbChange.setDatabase(e.target.value)} />
                </div>
            </div>
        </div>
      </CardContent>
      <CardFooter className="border-t bg-card px-6 py-4">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Сохранение...' : 'Сохранить все изменения'}
        </Button>
      </CardFooter>
    </Card>
  );
}
