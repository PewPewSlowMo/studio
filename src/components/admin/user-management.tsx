'use client';
import { useState } from 'react';
import type { User, AsteriskEndpoint } from '@/lib/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserFormDialog } from './user-form-dialog';
import { getAmiEndpoints } from '@/actions/ami';
import { useToast } from '@/hooks/use-toast';

interface UserManagementProps {
  users: User[];
  connection: {
    host: string;
    port: string;
    username: string;
    password: string;
  };
}

export function UserManagement({ users: initialUsers, connection }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [endpoints, setEndpoints] = useState<AsteriskEndpoint[]>([]);
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(false);
  const { toast } = useToast();

  const handleOpenDialog = async (user: User | null = null) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
    setIsLoadingEndpoints(true);

    const result = await getAmiEndpoints(connection);
    if (result.success && result.data) {
      setEndpoints(result.data);
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to fetch extensions',
        description: result.error || 'Could not retrieve Asterisk extensions.',
      });
      setEndpoints([]);
    }
    setIsLoadingEndpoints(false);
  };

  const handleSaveUser = (data: any) => {
    // In a real application, you would call a server action here to save the user
    // and then update the local state `setUsers(...)` to reflect the changes.
    console.log('Saving user:', data);
    toast({
      title: 'User Saved',
      description: `Details for ${data.name} have been saved successfully.`,
    });
    // This is a mock implementation to show the UI update.
    if (selectedUser) {
      // Editing existing user
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, ...data, extension: data.extension || undefined } : u));
    } else {
      // Creating new user
      const newUser: User = {
        id: `user-${Date.now()}`,
        username: data.email.split('@')[0],
        createdAt: new Date().toISOString(),
        isActive: true,
        ...data,
        extension: data.extension || undefined,
      };
      setUsers([...users, newUser]);
    }
  };

  return (
    <>
      <UserFormDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        user={selectedUser}
        endpoints={endpoints}
        onSave={handleSaveUser}
        isLoadingEndpoints={isLoadingEndpoints}
      />
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Create, edit, and manage system users and their extensions.
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" /> New User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Extension</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {user.role}
                      </Badge>
                    </TableCell>
                     <TableCell>
                      {user.extension ? (
                         <Badge variant="secondary">{user.extension}</Badge>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'default' : 'secondary'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDialog(user)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem>Deactivate</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive hover:!text-destructive-foreground">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
