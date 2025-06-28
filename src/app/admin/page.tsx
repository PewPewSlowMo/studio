'use client';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/admin/user-management';
import { SystemSettings } from '@/components/admin/system-settings';
import { mockUsers } from '@/lib/mock-data';
import { AsteriskOperators } from '@/components/admin/asterisk-operators';
import { AsteriskQueues } from '@/components/admin/asterisk-queues';

export default function AdminPage() {
  const [host, setHost] = useState('92.46.62.34');
  const [port, setPort] = useState('8088');
  const [username, setUsername] = useState('smart-call-center');
  const [password, setPassword] = useState('Almaty20252025');

  const connection = { host, port, username, password };

  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="users">User Management</TabsTrigger>
        <TabsTrigger value="settings">System Settings</TabsTrigger>
        <TabsTrigger value="operators">Asterisk Operators</TabsTrigger>
        <TabsTrigger value="queues">Asterisk Queues</TabsTrigger>
      </TabsList>
      <TabsContent value="users" className="mt-6">
        <UserManagement users={mockUsers} />
      </TabsContent>
      <TabsContent value="settings" className="mt-6">
        <SystemSettings
          connection={connection}
          onConnectionChange={{
            setHost,
            setPort,
            setUsername,
            setPassword,
          }}
        />
      </TabsContent>
      <TabsContent value="operators" className="mt-6">
        <AsteriskOperators connection={connection} />
      </TabsContent>
      <TabsContent value="queues" className="mt-6">
        <AsteriskQueues connection={connection} />
      </TabsContent>
    </Tabs>
  );
}
