'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Shield, Info, Network, Wifi, Database, Link as LinkIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/admin/user-management';
import { SystemSettings } from '@/components/admin/system-settings';
import { ConnectionStatusCard } from '@/components/admin/connection-status-card';
import { getAmiQueues, testAmiConnection } from '@/actions/ami';
import { testCdrConnection } from '@/actions/cdr';
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
  
  // State for connection testing
  const [isTestingAri, setIsTestingAri] = useState(false);
  const [ariStatus, setAriStatus] = useState<ConnectionStatus>('Unknown');
  
  const [isTestingAmi, setIsTestingAmi] = useState(false);
  const [amiStatus, setAmiStatus] = useState<ConnectionStatus>('Unknown');
  
  const [isTestingCdr, setIsTestingCdr] = useState(false);
  const [cdrStatus, setCdrStatus] = useState<ConnectionStatus>('Unknown');

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
      setAriStatus('Unknown');
      setAmiStatus('Unknown');
      setCdrStatus('Unknown');

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
      
      const [ariResult, amiResult, cdrResult] = await Promise.all([
        testAmiConnection(config.ari), // Testing ARI with an AMI command as it's the primary interface now
        getAmiQueues(config.ami),
        testCdrConnection(config.cdr),
      ]);

      setAriStatus(ariResult.success ? 'Connected' : 'Failed');
      setAmiStatus(amiResult.success ? 'Connected' : 'Failed');
      setCdrStatus(cdrResult.success ? 'Connected' : 'Failed');
      
      setIsTestingAri(false);
      setIsTestingAmi(false);
      setIsTestingCdr(false);
    };

    initializeAndCheck();
  }, []);

  const handleTestAri = async () => {
    setIsTestingAri(true);
    setAriStatus('Unknown');
    // We use testAmiConnection because ARI is now only a part of the Asterisk setup,
    // and a successful AMI connection is a better indicator of overall health for our app.
    const result = await testAmiConnection(ariConnection);
    if (result.success) {
      setAriStatus('Connected');
      toast({ title: 'Asterisk Connection Successful', description: `Successfully connected to Asterisk.` });
    } else {
      setAriStatus('Failed');
      toast({ variant: 'destructive', title: 'Asterisk Connection Failed', description: result.error });
    }
    setIsTestingAri(false);
  };

  const handleTestAmi = async () => {
    setIsTestingAmi(true);
    setAmiStatus('Unknown');
    const result = await getAmiQueues(amiConnection);
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

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const newConfig = {
      ari: ariConnection,
      ami: amiConnection,
      cdr: cdrConnection,
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
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="settings">Настройки системы</TabsTrigger>
          <TabsTrigger value="users">Управление пользователями</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-6 space-y-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <ConnectionStatusCard
                    icon={Network}
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
                    variant="success"
                />
                <ConnectionStatusCard
                    icon={Database}
                    title="CDR База данных"
                    status={cdrStatus}
                    port={cdrPort}
                    onTest={handleTestCdr}
                    isTesting={isTestingCdr}
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
      </Tabs>
    </div>
  );
}
