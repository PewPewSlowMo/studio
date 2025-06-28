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
import { PlusCircle, MoreHorizontal, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UserFormDialog, type UserFormData } from './user-form-dialog';
import { getAmiEndpoints } from '@/actions/ami';
import { addUser, updateUser, deleteUser, toggleUserStatus } from '@/actions/users';
import { useToast } from '@/hooks/use-toast';

interface UserManagementProps {
  connection: {
    host: string;
    port: string;
    username: string;
    password: string;
  };
  users: User[];
  fetchUsers: () => void;
  isFetchingUsers: boolean;
}

export function UserManagement({ connection, users, fetchUsers, isFetchingUsers }: UserManagementProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [endpoints, setEndpoints] = useState<AsteriskEndpoint[]>([]);
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const { toast } = useToast();

  const handleOpenDialog = async (user: User | null = null) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
    setIsLoadingEndpoints(true);

    try {
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
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Network Error',
        description: 'Failed to connect to Asterisk to get extensions.',
      });
    } finally {
      setIsLoadingEndpoints(false);
    }
  };

  const handleSaveUser = async (data: UserFormData) => {
    try {
      if (selectedUser) {
        await updateUser(selectedUser.id, data);
      } else {
        await addUser(data);
      }
      toast({
        title: 'User Saved',
        description: `Details for ${data.name} have been saved successfully.`,
      });
      fetchUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to save user',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
  };
  
  const handleOpenDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };
  
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(userToDelete.id);
      toast({
        title: 'User Deleted',
        description: `User ${userToDelete.name} has been deleted.`,
      });
      fetchUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete user',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await toggleUserStatus(user.id, user.isActive);
      toast({
        title: 'User Status Updated',
        description: `User ${user.name} has been ${user.isActive ? 'deactivated' : 'activated'}.`,
      });
      fetchUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update status',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
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
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
              account for "{userToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Create, edit, and manage system users from the database.
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
                {isFetchingUsers ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="text-muted-foreground">Loading users...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No users found. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
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
                            <DropdownMenuItem onClick={() => handleOpenDialog(user)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                              {user.isActive ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:!bg-destructive/10 hover:!text-destructive"
                              onClick={() => handleOpenDeleteDialog(user)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
