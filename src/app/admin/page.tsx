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
import { testCdrConnection } from '@/actions/cdr';
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
  
  // State for CDR DB connection
  const [cdrHost, setCdrHost] = useState('92.46.62.34');
  const [cdrPort, setCdrPort] = useState('3306');
  const [cdrUsername, setCdrUsername] = useState('freepbxuser');
  const [cdrPassword, setCdrPassword] = useState('42e09f1b23ced2f4cc474a04b4505313');
  const [cdrDatabase, setCdrDatabase] = useState('asterisk');
  const [isTestingCdr, setIsTestingCdr] = useState(false);
  const [cdrStatus, setCdrStatus] = useState<ConnectionStatus>('Unknown');

  // Memoize connection objects
  const ariConnection = useMemo(() => ({ host: ariHost, port: ariPort, username: ariUsername, password: ariPassword }), [ariHost, ariPort, ariUsername, ariPassword]);
  const amiConnection = useMemo(() => ({ host: amiHost, port: amiPort, username: amiUsername, password: amiPassword }), [amiHost, amiPort, amiUsername, amiPassword]);
  const cdrConnection = useMemo(() => ({ host: cdrHost, port: cdrPort, username: cdrUsername, password: cdrPassword, database: cdrDatabase }), [cdrHost, cdrPort, cdrUsername, cdrPassword, cdrDatabase]);

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
      setIsTestingCdr(true);

      const [ariResult, amiResult, cdrResult] = await Promise.all([
        getAsteriskVersion(ariConnection),
        getAmiQueues(amiConnection),
        testCdrConnection(cdrConnection),
      ]);

      setAriStatus(ariResult.success ? 'Connected' : 'Failed');
      setAmiStatus(amiResult.success ? 'Connected' : 'Failed');
      setCdrStatus(cdrResult.success ? 'Connected' : 'Failed');
      
      setIsTestingAri(false);
      setIsTestingAmi(false);
      setIsTestingCdr(false);
    };

    if (ariConnection.host && amiConnection.host && cdrConnection.host) {
        checkConnections();
    }
  }, [ariConnection, amiConnection, cdrConnection]);


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
            />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UserManagement connection={amiConnection} users={users} fetchUsers={fetchUsers} isFetchingUsers={isFetchingUsers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
