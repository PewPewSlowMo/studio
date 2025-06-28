'use client';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/admin/user-management';
import { SystemSettings } from '@/components/admin/system-settings';
import { mockUsers } from '@/lib/mock-data';
import { AsteriskOperators } from '@/components/admin/asterisk-operators';
import { AsteriskQueues } from '@/components/admin/asterisk-queues';
import type { User } from '@/lib/types';

export default function AdminPage() {
  // State for ARI connection
  const [ariHost, setAriHost] = useState('92.46.62.34');
  const [ariPort, setAriPort] = useState('8088');
  const [ariUsername, setAriUsername] = useState('smart-call-center');
  const [ariPassword, setAriPassword] = useState('Almaty20252025');

  // State for AMI connection
  const [amiHost, setAmiHost] = useState('92.46.62.34');
  const [amiPort, setAmiPort] = useState('5038');
  const [amiUsername, setAmiUsername] = useState('smart_call_cent');
  const [amiPassword, setAmiPassword] = useState('Almaty20252025');
  
  // Lifted state for users
  const [users, setUsers] = useState<User[]>(mockUsers);

  const ariConnection = { host: ariHost, port: ariPort, username: ariUsername, password: ariPassword };
  const amiConnection = { host: amiHost, port: amiPort, username: amiUsername, password: amiPassword };

  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="users">User Management</TabsTrigger>
        <TabsTrigger value="settings">System Settings</TabsTrigger>
        <TabsTrigger value="operators">Asterisk Operators</TabsTrigger>
        <TabsTrigger value="queues">Asterisk Queues</TabsTrigger>
      </TabsList>
      <TabsContent value="users" className="mt-6">
        <UserManagement users={users} setUsers={setUsers} connection={amiConnection} />
      </TabsContent>
      <TabsContent value="settings" className="mt-6">
        <SystemSettings
          connection={ariConnection}
          onConnectionChange={{
            setHost: setAriHost,
            setPort: setAriPort,
            setUsername: setAriUsername,
            setPassword: setAriPassword,
          }}
        />
      </TabsContent>
      <TabsContent value="operators" className="mt-6">
        <AsteriskOperators connection={amiConnection} />
      </TabsContent>
      <TabsContent value="queues" className="mt-6">
        <AsteriskQueues connection={amiConnection} />
      </TabsContent>
    </Tabs>
  );
}
