import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/admin/user-management';
import { SystemSettings } from '@/components/admin/system-settings';
import { mockUsers } from '@/lib/mock-data';

export default function AdminPage() {
  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="users">User Management</TabsTrigger>
        <TabsTrigger value="settings">System Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="users" className="mt-6">
        <UserManagement users={mockUsers} />
      </TabsContent>
      <TabsContent value="settings" className="mt-6">
        <SystemSettings />
      </TabsContent>
    </Tabs>
  );
}
