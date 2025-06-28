'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Shield, Info, Network, Wifi, Database, Link as LinkIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/admin/user-management';
import { SystemSettings } from '@/components/admin/system-settings';
import { ConnectionStatusCard } from '@/components/admin/connection-status-card';
import { getAsteriskVersion } from '@/actions/asterisk';
import { getAmiQueues } from '@/actions/ami';
import { toast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { getUsers } from '@/actions/users';

type ConnectionStatus = 'Unknown' | 'Connected' | 'Failed';

export default function AdminPage() {
  // State for users
  const [users, setUsers] = useState<User[]>([]);
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);

  // State for ARI connection
  const [ariHost, setAriHost] = useState('92.46.62.34');
  const [ariPort, setAriPort] = useState('8088');
  const [ariUsername, setAriUsername] = useState('smart-call-center');
  const [ariPassword, setAriPassword] = useState('Almaty20252025');
  const [isTestingAri, setIsTestingAri] = useState(false);
  const [ariStatus, setAriStatus] = useState<ConnectionStatus>('Unknown');

  // State for AMI connection
  const [amiHost, setAmiHost] = useState('92.46.62.34');
  const [amiPort, setAmiPort] = useState('5038');
  const [amiUsername, setAmiUsername] = useState('smart_call_cent');
  const [amiPassword, setAmiPassword] = useState('Almaty20252025');
  const [isTestingAmi, setIsTestingAmi] = useState(false);
  const [amiStatus, setAmiStatus] = useState<ConnectionStatus>('Unknown');
  
  // Memoize connection objects
  const ariConnection = useMemo(() => ({ host: ariHost, port: ariPort, username: ariUsername, password: ariPassword }), [ariHost, ariPort, ariUsername, ariPassword]);
  const amiConnection = useMemo(() => ({ host: amiHost, port: amiPort, username: amiUsername, password: amiPassword }), [amiHost, amiPort, amiUsername, amiPassword]);

  const handleTestAri = async () => {
    setIsTestingAri(true);
    setAriStatus('Unknown');
    const result = await getAsteriskVersion(ariConnection);
    if (result.success) {
      setAriStatus('Connected');
      toast({ title: 'ARI Connection Successful', description: `Connected to Asterisk version: ${result.version}` });
    } else {
      setAriStatus('Failed');
      toast({ variant: 'destructive', title: 'ARI Connection Failed', description: result.error });
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
  
  // Healthcheck for connections on load and when details change
  useEffect(() => {
    const checkConnections = async () => {
      setIsTestingAri(true);
      setIsTestingAmi(true);

      const [ariResult, amiResult] = await Promise.all([
        getAsteriskVersion(ariConnection),
        getAmiQueues(amiConnection),
      ]);

      setAriStatus(ariResult.success ? 'Connected' : 'Failed');
      setAmiStatus(amiResult.success ? 'Connected' : 'Failed');
      
      setIsTestingAri(false);
      setIsTestingAmi(false);
    };

    if (ariConnection.host && amiConnection.host) {
        checkConnections();
    }
  }, [ariConnection, amiConnection]);


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
                    title="ARI Interface"
                    status={ariStatus}
                    port={ariPort}
                    onTest={handleTestAri}
                    isTesting={isTestingAri}
                />
                <ConnectionStatusCard
                    icon={Wifi}
                    title="AMI Interface"
                    status={amiStatus}
                    port={amiPort}
                    onTest={handleTestAmi}
                    isTesting={isTestingAmi}
                    variant="success"
                />
                <ConnectionStatusCard
                    icon={Database}
                    title="База данных"
                    status="Connected"
                    port="Local JSON"
                    onTest={() => toast({ title: 'Database Test', description: 'Connection is handled locally via JSON file.' })}
                    isTesting={false}
                    isDb
                />
            </div>
            <SystemSettings
                ariConnection={ariConnection}
                amiConnection={amiConnection}
                onAriChange={{ setHost: setAriHost, setPort: setAriPort, setUsername: setAriUsername, setPassword: setAriPassword }}
                onAmiChange={{ setHost: setAmiHost, setPort: setAmiPort, setUsername: setAmiUsername, setPassword: setAmiPassword }}
            />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UserManagement connection={amiConnection} users={users} fetchUsers={fetchUsers} isFetchingUsers={isFetchingUsers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
