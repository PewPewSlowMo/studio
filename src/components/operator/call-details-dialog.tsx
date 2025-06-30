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
                <h3 className="font-semibold text-lg">Детали обращения</h3>
                <Separator />
                {appeal ? (
                    <div className="space-y-2 text-sm">
                       <p><strong>Тип:</strong> <Badge variant="secondary" className="capitalize">{appeal.appealType}</Badge></p>
                       <p><strong>Описание:</strong></p>
                       <p className="p-2 bg-muted rounded-md">{appeal.description}</p>
                       <p><strong>Решение:</strong></p>
                       <p className="p-2 bg-muted rounded-md">{appeal.resolution || 'Не указано'}</p>
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
