'use client';

import { useState, useEffect } from 'react';
import type { Call, Appeal, CrmContact } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Loader2, FileText, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getAppeals } from '@/actions/appeals';
import { findContactByPhone } from '@/actions/crm';
import { CrmEditor } from './crm-editor';
import { Separator } from '@/components/ui/separator';
import { format, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';

interface CallDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  call: Call | null;
  isCrmEditable?: boolean;
}

const statusMap: Record<string, string> = {
    ANSWERED: 'Отвечен',
    'NO ANSWER': 'Без ответа',
    BUSY: 'Занято',
    FAILED: 'Ошибка',
};

const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'dd.MM.yyyy HH:mm:ss', { locale: ru }) : 'Неверная дата';
};

const formatDuration = (seconds: number | undefined) => {
    if (seconds === undefined || seconds === null) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function CallDetailsDialog({ isOpen, onOpenChange, call, isCrmEditable = true }: CallDetailsDialogProps) {
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [contact, setContact] = useState<CrmContact | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!call) return;
      setIsLoading(true);

      try {
        const [appealsResult, contactResult] = await Promise.all([
          getAppeals(),
          findContactByPhone(call.callerNumber)
        ]);
        
        const foundAppeal = appealsResult.find(a => a.callId === call.id) || null;
        setAppeal(foundAppeal);

        if (contactResult.contact) {
            setContact(contactResult.contact);
        } else {
            setContact(null);
        }

      } catch (error) {
        console.error("Failed to fetch call details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen, call]);
  
  const handleSaveContact = (savedContact: CrmContact) => {
      setContact(savedContact);
  }

  const priorityMap: Record<Appeal['priority'], string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
  };

  const satisfactionMap: Record<Appeal['satisfaction'], string> = {
    yes: 'Да',
    no: 'Нет',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Детали звонка от {call?.callerNumber}</DialogTitle>
          <DialogDescription>
            Подробная информация об обращении и данные клиента.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 py-4">
            <div className="space-y-4">
                <h3 className="font-semibold text-lg">Информация о звонке</h3>
                <Separator />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <p><strong>Оператор:</strong> {call?.operatorName || 'N/A'}</p>
                    <p><strong>Статус:</strong> {call?.status ? <Badge variant={call.status === 'ANSWERED' ? 'success' : 'destructive'}>{statusMap[call.status] || call.status}</Badge> : 'N/A'}</p>
                    <p><strong>Дата:</strong> {call ? formatDate(call.startTime) : 'N/A'}</p>
                    <p><strong>Очередь:</strong> {call?.queue || 'Без очереди'}</p>
                    <p><strong>Время разговора:</strong> {call ? formatDuration(call.billsec) : 'N/A'}</p>
                    <p><strong>Время ожидания:</strong> {call ? formatDuration(call.waitTime) : 'N/A'}</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Детали обращения</h3>
                </div>
                <Separator />
                {appeal ? (
                    <div className="space-y-2 text-sm">
                       <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                         <p><strong>Категория:</strong> <Badge variant="secondary" className="capitalize">{appeal.category}</Badge></p>
                         <p><strong>Приоритет:</strong> <Badge variant="outline" className="capitalize">{priorityMap[appeal.priority] || appeal.priority}</Badge></p>
                         <p><strong>Удовлетворенность:</strong> <Badge variant="outline" className="capitalize">{satisfactionMap[appeal.satisfaction] || appeal.satisfaction}</Badge></p>
                         <p><strong>Нужен контакт:</strong> {appeal.followUp ? 'Да' : 'Нет'}</p>
                       </div>
                       <Separator className="my-2" />
                       <p><strong>Описание:</strong></p>
                       <p className="p-2 bg-muted rounded-md">{appeal.description}</p>
                       <p><strong>Решение:</strong></p>
                       <p className="p-2 bg-muted rounded-md capitalize">{appeal.resolution || 'Не указано'}</p>
                       {appeal.notes && <>
                         <p><strong>Доп. заметки:</strong></p>
                         <p className="p-2 bg-muted rounded-md">{appeal.notes}</p>
                       </>}
                    </div>
                ): (
                    <div className="text-center text-muted-foreground p-4 border border-dashed rounded-md">
                        <Info className="mx-auto h-8 w-8 mb-2" />
                        <p>Для этого звонка не было создано карточки обращения.</p>
                    </div>
                )}
            </div>
            
            <CrmEditor
                contact={contact}
                phoneNumber={call?.callerNumber || ''}
                onSave={handleSaveContact}
                isEditable={isCrmEditable}
            />

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
