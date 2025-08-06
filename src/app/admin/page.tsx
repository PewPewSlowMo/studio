'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Shield, Info, Network, Wifi, Database, Link as LinkIcon, Server } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/admin/user-management';
import { SystemSettings } from '@/components/admin/system-settings';
import { QueueManagement } from '@/components/admin/queue-management';
import { ConnectionStatusCard } from '@/components/admin/connection-status-card';
import { testAriConnection } from '@/actions/ari';
import { testAmiConnection } from '@/actions/ami';
import { testCdrConnection } from '@/actions/cdr';
import { initializeDatabase, testAppDbConnection } from '@/actions/app-db';
import { getConfig, saveConfig } from '@/actions/config';
import { toast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { getUsers } from '@/actions/users';

type ConnectionStatus = 'Unknown' | 'Connected' | 'Failed';

export default function AdminPage() {
  // State for users
  const [users, setUsers] = useState<User[]>([]);
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);

  // State for connection settings
  const [ariHost, setAriHost] = useState('');
  const [ariPort, setAriPort] = useState('');
  const [ariUsername, setAriUsername] = useState('');
  const [ariPassword, setAriPassword] = useState('');
  
  const [amiHost, setAmiHost] = useState('');
  const [amiPort, setAmiPort] = useState('');
  const [amiUsername, setAmiUsername] = useState('');
  const [amiPassword, setAmiPassword] = useState('');
  
  const [cdrHost, setCdrHost] = useState('');
  const [cdrPort, setCdrPort] = useState('');
  const [cdrUsername, setCdrUsername] = useState('');
  const [cdrPassword, setCdrPassword] = useState('');
  const [cdrDatabase, setCdrDatabase] = useState('');

  const [queueMappings, setQueueMappings] = useState<Record<string, string>>({});
  
  // State for connection testing
  const [isTestingAri, setIsTestingAri] = useState(false);
  const [ariStatus, setAriStatus] = useState<ConnectionStatus>('Unknown');
  
  const [isTestingAmi, setIsTestingAmi] = useState(false);
  const [amiStatus, setAmiStatus] = useState<ConnectionStatus>('Unknown');
  
  const [isTestingCdr, setIsTestingCdr] = useState(false);
  const [cdrStatus, setCdrStatus] = useState<ConnectionStatus>('Unknown');

  const [isTestingAppDb, setIsTestingAppDb] = useState(false);
  const [appDbStatus, setAppDbStatus] = useState<ConnectionStatus>('Unknown');
  const [appDbVersion, setAppDbVersion] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);

  // Memoize connection objects
  const ariConnection = useMemo(() => ({ host: ariHost, port: ariPort, username: ariUsername, password: ariPassword }), [ariHost, ariPort, ariUsername, ariPassword]);
  const amiConnection = useMemo(() => ({ host: amiHost, port: amiPort, username: amiUsername, password: amiPassword }), [amiHost, amiPort, amiUsername, amiPassword]);
  const cdrConnection = useMemo(() => ({ host: cdrHost, port: cdrPort, username: cdrUsername, password: cdrPassword, database: cdrDatabase }), [cdrHost, cdrPort, cdrUsername, cdrPassword, cdrDatabase]);

  // Load config and perform initial healthcheck on mount
  useEffect(() => {
    const initializeAndCheck = async () => {
      setIsTestingAri(true);
      setIsTestingAmi(true);
      setIsTestingCdr(true);
      setIsTestingAppDb(true);
      
      // Ensure DB is initialized before any other action
      await initializeDatabase();

      const config = await getConfig();
      
      setAriHost(config.ari.host);
      setAriPort(config.ari.port);
      setAriUsername(config.ari.username);
      setAriPassword(config.ari.password);

      setAmiHost(config.ami.host);
      setAmiPort(config.ami.port);
      setAmiUsername(config.ami.username);
      setAmiPassword(config.ami.password);
      
      setCdrHost(config.cdr.host);
      setCdrPort(config.cdr.port);
      setCdrUsername(config.cdr.username);
      setCdrPassword(config.cdr.password);
      setCdrDatabase(config.cdr.database);
      setQueueMappings(config.queueMappings || {});
      
      const [ariResult, amiResult, cdrResult, appDbResult] = await Promise.all([
        testAriConnection(config.ari),
        testAmiConnection(config.ami),
        testCdrConnection(config.cdr),
        testAppDbConnection(),
      ]);
      
      setAriStatus(ariResult.success ? 'Connected' : 'Failed');
      setAmiStatus(amiResult.success ? 'Connected' : 'Failed');
      setCdrStatus(cdrResult.success ? 'Connected' : 'Failed');
      setAppDbStatus(appDbResult.success ? 'Connected' : 'Failed');
      if (appDbResult.success) setAppDbVersion(appDbResult.data?.version);
      
      setIsTestingAri(false);
      setIsTestingAmi(false);
      setIsTestingCdr(false);
      setIsTestingAppDb(false);
    };

    initializeAndCheck();
  }, []);

  const handleTestAri = async () => {
    setIsTestingAri(true);
    setAriStatus('Unknown');
    const result = await testAriConnection(ariConnection);
    if (result.success) {
      setAriStatus('Connected');
      toast({ title: 'ARI Connection Successful', description: 'Successfully connected to the Asterisk REST Interface.' });
    } else {
      setAriStatus('Failed');
      toast({ variant: 'destructive', title: 'ARI Connection Failed', description: result.error });
    }
    setIsTestingAri(false);
  };

  const handleTestAmi = async () => {
    setIsTestingAmi(true);
    setAmiStatus('Unknown');
    const result = await testAmiConnection(amiConnection);
    if (result.success) {
      setAmiStatus('Connected');
      toast({ title: 'AMI Connection Successful', description: 'Successfully connected to AMI and fetched data.' });
    } else {
      setAmiStatus('Failed');
      toast({ variant: 'destructive', title: 'AMI Connection Failed', description: result.error });
    }
    setIsTestingAmi(false);
  };
  
  const handleTestCdr = async () => {
    setIsTestingCdr(true);
    setCdrStatus('Unknown');
    const result = await testCdrConnection(cdrConnection);
    if (result.success) {
      setCdrStatus('Connected');
      toast({ title: 'CDR DB Connection Test Successful', description: 'Connection details are valid. Ready for data retrieval.' });
    } else {
      setCdrStatus('Failed');
      toast({ variant: 'destructive', title: 'CDR DB Connection Test Failed', description: result.error });
    }
    setIsTestingCdr(false);
  };

  const handleTestAppDb = async () => {
    setIsTestingAppDb(true);
    setAppDbStatus('Unknown');
    const result = await testAppDbConnection();
    if (result.success) {
      setAppDbStatus('Connected');
      setAppDbVersion(result.data?.version);
      toast({ title: 'App DB Connection Successful', description: 'Successfully connected to the application SQLite database.' });
    } else {
      setAppDbStatus('Failed');
      toast({ variant: 'destructive', title: 'App DB Connection Failed', description: result.error });
    }
    setIsTestingAppDb(false);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const newConfig = {
      ari: ariConnection,
      ami: amiConnection,
      cdr: cdrConnection,
      queueMappings: queueMappings
    };
    const result = await saveConfig(newConfig);
    if (result.success) {
      toast({ title: 'Настройки сохранены', description: 'Конфигурация успешно обновлена.' });
    } else {
      toast({ variant: 'destructive', title: 'Ошибка сохранения', description: result.error });
    }
    setIsSaving(false);
  };

  const fetchUsers = useCallback(async () => {
    setIsFetchingUsers(true);
    try {
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers);
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Failed to fetch users',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    } finally {
        setIsFetchingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Shield className="h-10 w-10 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Администрирование</h1>
          <p className="text-muted-foreground">Управление системными настройками и пользователями</p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Вы находитесь в административной панели.</AlertTitle>
        <AlertDescription>
          Изменения могут повлиять на работу всей системы.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="settings">Настройки системы</TabsTrigger>
          <TabsTrigger value="users">Управление пользователями</TabsTrigger>
          <TabsTrigger value="mappings">Связки</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-6 space-y-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
                <ConnectionStatusCard
                    icon={LinkIcon}
                    title="Asterisk (ARI)"
                    status={ariStatus}
                    port={ariPort}
                    onTest={handleTestAri}
                    isTesting={isTestingAri}
                />
                <ConnectionStatusCard
                    icon={Wifi}
                    title="Asterisk (AMI)"
                    status={amiStatus}
                    port={amiPort}
                    onTest={handleTestAmi}
                    isTesting={isTestingAmi}
                />
                <ConnectionStatusCard
                    icon={Database}
                    title="CDR База данных (MySQL)"
                    status={cdrStatus}
                    port={cdrPort}
                    onTest={handleTestCdr}
                    isTesting={isTestingCdr}
                />
                 <ConnectionStatusCard
                    icon={Server}
                    title="База приложения (SQLite)"
                    status={appDbStatus}
                    port={appDbVersion ? `v${appDbVersion}` : '...'}
                    onTest={handleTestAppDb}
                    isTesting={isTestingAppDb}
                    variant="success"
                />
            </div>
            <SystemSettings
                ariConnection={ariConnection}
                amiConnection={amiConnection}
                cdrConnection={cdrConnection}
                onAriChange={{ setHost: setAriHost, setPort: setAriPort, setUsername: setAriUsername, setPassword: setAriPassword }}
                onAmiChange={{ setHost: setAmiHost, setPort: setAmiPort, setUsername: setAmiUsername, setPassword: setAmiPassword }}
                onCdrChange={{ setHost: setCdrHost, setPort: setCdrPort, setUsername: setCdrUsername, setPassword: setCdrPassword, setDatabase: setCdrDatabase }}
                onSave={handleSaveSettings}
                isSaving={isSaving}
            />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UserManagement connection={amiConnection} users={users} fetchUsers={fetchUsers} isFetchingUsers={isFetchingUsers} />
        </TabsContent>
         <TabsContent value="mappings" className="mt-6">
          <QueueManagement 
            amiConnection={amiConnection}
            mappings={queueMappings}
            onSave={handleSaveSettings}
            onMappingsChange={setQueueMappings}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
