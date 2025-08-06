'use client';

import { useState, useEffect } from 'react';
import type { AsteriskQueue } from '@/lib/types';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAmiQueues } from '@/actions/ami';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface QueueManagementProps {
  amiConnection: {
    host: string;
    port: string;
    username: string;
    password: string;
  };
  mappings: Record<string, string>;
  onMappingsChange: (mappings: Record<string, string>) => void;
  onSave: () => void;
}

export function QueueManagement({ amiConnection, mappings, onMappingsChange, onSave }: QueueManagementProps) {
  const [queues, setQueues] = useState<AsteriskQueue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchQueues = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getAmiQueues(amiConnection);
        if (result.success && result.data) {
          setQueues(result.data);
        } else {
          setError(result.error || 'Не удалось загрузить список очередей из Asterisk.');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Произошла неизвестная ошибка.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchQueues();
  }, [amiConnection]);

  const handleNameChange = (queueNumber: string, name: string) => {
    onMappingsChange({
      ...mappings,
      [queueNumber]: name,
    });
  };

  const handleSaveChanges = () => {
    onSave();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Управление очередями</CardTitle>
          <CardDescription>Загрузка списка очередей из Asterisk...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-48">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Ошибка загрузки очередей</AlertTitle>
        <AlertDescription>
            <p>{error}</p>
            <p className="mt-2">Пожалуйста, проверьте настройки подключения к AMI на вкладке "Настройки системы".</p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
            <LinkIcon className="h-8 w-8 text-muted-foreground" />
            <div>
                <CardTitle>Имена очередей</CardTitle>
                <CardDescription>
                    Присвойте понятные имена для технических номеров очередей. Эти имена будут использоваться во всех отчетах.
                </CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Номер очереди</TableHead>
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
                      value={mappings[queue.name] || ''}
                      onChange={(e) => handleNameChange(queue.name, e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveChanges}>
          <Save className="mr-2 h-4 w-4" /> Сохранить изменения
        </Button>
      </CardFooter>
    </Card>
  );
}
