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
          title: 'Не удалось получить внутренние номера',
          description: result.error || 'Не удалось получить номера Asterisk.',
        });
        setEndpoints([]);
      }
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Сетевая ошибка',
        description: 'Не удалось подключиться к Asterisk для получения номеров.',
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
        title: 'Пользователь сохранен',
        description: `Данные для ${data.name} были успешно сохранены.`,
      });
      fetchUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Не удалось сохранить пользователя',
        description: error instanceof Error ? error.message : 'Произошла неизвестная ошибка.',
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
        title: 'Пользователь удален',
        description: `Пользователь ${userToDelete.name} был удален.`,
      });
      fetchUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Не удалось удалить пользователя',
        description: error instanceof Error ? error.message : 'Произошла неизвестная ошибка.',
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
        title: 'Статус пользователя обновлен',
        description: `Пользователь ${user.name} был ${user.isActive ? 'деактивирован' : 'активирован'}.`,
      });
      fetchUsers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Не удалось обновить статус',
        description: error instanceof Error ? error.message : 'Произошла неизвестная ошибка.',
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
            <AlertDialogTitle>Вы абсолютно уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя будет отменить. Учетная запись пользователя
              "{userToDelete?.name}" будет удалена навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>
              Продолжить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Управление пользователями</CardTitle>
              <CardDescription>
                Создавайте, редактируйте и управляйте пользователями системы.
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Новый пользователь
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Внутр. номер</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>
                    <span className="sr-only">Действия</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetchingUsers ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="text-muted-foreground">Загрузка пользователей...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Пользователи не найдены. Создайте нового.
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
                          {user.isActive ? 'Активен' : 'Неактивен'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Открыть меню</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(user)}>
                              Редактировать
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                              {user.isActive ? 'Деактивировать' : 'Активировать'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:!bg-destructive/10 hover:!text-destructive"
                              onClick={() => handleOpenDeleteDialog(user)}
                            >
                              Удалить
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
