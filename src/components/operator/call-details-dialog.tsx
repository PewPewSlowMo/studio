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

interface CallDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  call: Call | null;
}

export function CallDetailsDialog({ isOpen, onOpenChange, call }: CallDetailsDialogProps) {
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

  const categoryMap: Record<Appeal['category'], string> = {
    sales: 'Продажи',
    complaint: 'Жалоба',
    support: 'Техподдержка',
    info: 'Информация',
    other: 'Другое',
  };

  const priorityMap: Record<Appeal['priority'], string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
  };

  const satisfactionMap: Record<Appeal['satisfaction'], string> = {
    satisfied: 'Доволен',
    neutral: 'Нейтрально',
    dissatisfied: 'Недоволен',
    'n/a': 'Неприменимо',
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
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Детали обращения</h3>
                    <span className="text-xs font-mono text-muted-foreground">Lookup ID: {call?.id || '...'}</span>
                </div>
                <Separator />
                {appeal ? (
                    <div className="space-y-2 text-sm">
                       <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                         <p><strong>Категория:</strong> <Badge variant="secondary" className="capitalize">{categoryMap[appeal.category] || appeal.category}</Badge></p>
                         <p><strong>Приоритет:</strong> <Badge variant="outline" className="capitalize">{priorityMap[appeal.priority] || appeal.priority}</Badge></p>
                         <p><strong>Удовлетворенность:</strong> <Badge variant="outline" className="capitalize">{satisfactionMap[appeal.satisfaction] || appeal.satisfaction}</Badge></p>
                         <p><strong>Нужен контакт:</strong> {appeal.followUp ? 'Да' : 'Нет'}</p>
                       </div>
                       <Separator className="my-2" />
                       <p><strong>Описание:</strong></p>
                       <p className="p-2 bg-muted rounded-md">{appeal.description}</p>
                       <p><strong>Решение:</strong></p>
                       <p className="p-2 bg-muted rounded-md">{appeal.resolution || 'Не указано'}</p>
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
            
            <CrmEditor contact={contact} phoneNumber={call?.callerNumber || ''} onSave={handleSaveContact} />

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
