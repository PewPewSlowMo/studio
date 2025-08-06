'use client';

import { useState, useEffect } from 'react';
import type { AsteriskQueue, AsteriskEndpoint, User } from '@/lib/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAmiQueues, getAmiEndpoints } from '@/actions/ami';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Link as LinkIcon, AlertTriangle, RefreshCw, Users, Component } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface BindingsManagementProps {
  amiConnection: {
    host: string;
    port: string;
    username: string;
    password: string;
  };
  initialMappings: Record<string, string>;
  users: User[];
  onSave: (updatedUsers: User[], updatedQueueMappings: Record<string, string>) => void;
  isSaving: boolean;
}

export function BindingsManagement({ amiConnection, initialMappings, users, onSave, isSaving }: BindingsManagementProps) {
  const [queues, setQueues] = useState<AsteriskQueue[]>([]);
  const [endpoints, setEndpoints] = useState<AsteriskEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [localUsers, setLocalUsers] = useState<User[]>([]);
  const [queueMappings, setQueueMappings] = useState<Record<string, string>>({});
  
  const { toast } = useToast();

  useEffect(() => {
    setLocalUsers(JSON.parse(JSON.stringify(users)));
  }, [users]);
  
  useEffect(() => {
    setQueueMappings(initialMappings);
  }, [initialMappings]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [queuesResult, endpointsResult] = await Promise.all([
        getAmiQueues(amiConnection),
        getAmiEndpoints(amiConnection)
      ]);
      
      if (queuesResult.success && queuesResult.data) {
        setQueues(queuesResult.data);
      } else {
        setError(queuesResult.error || 'Не удалось загрузить список очередей.');
      }

      if (endpointsResult.success && endpointsResult.data) {
        setEndpoints(endpointsResult.data);
      } else {
        setError((prev) => prev ? `${prev} ${endpointsResult.error || 'Не удалось загрузить эндпоинты.'}` : endpointsResult.error || 'Не удалось загрузить эндпоинты.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Произошла неизвестная ошибка.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleQueueNameChange = (queueNumber: string, name: string) => {
    setQueueMappings({
      ...queueMappings,
      [queueNumber]: name,
    });
  };

  const handleUserBinding = (endpointResource: string, userId: string) => {
      setLocalUsers(currentUsers => {
        const newUsers = JSON.parse(JSON.stringify(currentUsers));
        // Un-assign from the old user if any
        const oldUser = newUsers.find((u: User) => u.extension === endpointResource);
        if (oldUser) {
            oldUser.extension = null;
        }
        // Assign to the new user
        const newUser = newUsers.find((u: User) => u.id === userId);
        if (newUser) {
            newUser.extension = endpointResource;
        }
        return newUsers;
      });
  };

  const handleSaveChanges = () => {
    onSave(localUsers, queueMappings);
  };
  
  const endpointUserMap = new Map(localUsers.filter(u => u.extension).map(u => [u.extension, u.id]));

  if (error) {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <LinkIcon className="h-8 w-8 text-muted-foreground" />
                        <div>
                            <CardTitle>Управление связками</CardTitle>
                            <CardDescription>
                                Привяжите пользователей к номерам, а имена к очередям.
                            </CardDescription>
                        </div>
                    </div>
                    <Button onClick={fetchData} disabled={isLoading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? 'Загрузка...' : 'Получить данные'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Ошибка загрузки</AlertTitle>
                    <AlertDescription>
                        <p>{error}</p>
                        <p className="mt-2">Пожалуйста, проверьте настройки подключения к AMI на вкладке "Настройки системы".</p>
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
                <LinkIcon className="h-8 w-8 text-muted-foreground" />
                <div>
                    <CardTitle>Управление связками</CardTitle>
                    <CardDescription>
                        Привяжите пользователей к номерам, а имена к очередям.
                    </CardDescription>
                </div>
            </div>
            <Button onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Загрузка...' : 'Получить данные'}
            </Button>
        </div>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-8">
        {/* Endpoints */}
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Внутренние номера (Endpoints)</h3>
            </div>
            {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                <div className="rounded-md border max-h-96 overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                                <TableHead className="w-[150px]">Номер</TableHead>
                                <TableHead>Привязанный пользователь</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {endpoints.map((endpoint) => (
                            <TableRow key={endpoint.resource}>
                                <TableCell className="font-medium">{endpoint.resource}</TableCell>
                                <TableCell>
                                    <Select
                                        value={endpointUserMap.get(endpoint.resource) || 'unassigned'}
                                        onValueChange={(userId) => handleUserBinding(endpoint.resource, userId)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Выберите пользователя..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Не привязан</SelectItem>
                                            {users.filter(u => u.role === 'operator').map(user => (
                                                <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>

        {/* Queues */}
        <div className="space-y-4">
             <div className="flex items-center gap-3">
                <Component className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Очереди вызовов</h3>
            </div>
            {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                <div className="rounded-md border max-h-96 overflow-y-auto">
                <Table>
                    <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                        <TableHead className="w-[150px]">Номер</TableHead>
                        <TableHead>Отображаемое имя</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {queues.map((queue) => (
                        <TableRow key={queue.name}>
                        <TableCell className="font-medium">{queue.name}</TableCell>
                        <TableCell>
                            <Input
                            type="text"
                            placeholder="Например, 'Отдел продаж'"
                            value={queueMappings[queue.name] || ''}
                            onChange={(e) => handleQueueNameChange(queue.name, e.target.value)}
                            />
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </div>
            )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveChanges} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isSaving ? 'Сохранение...' : 'Сохранить все связки'}
        </Button>
      </CardFooter>
    </Card>
  );
}
