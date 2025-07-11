'use client';

import { useState, useEffect, use } from 'react';
import type { Call, Appeal, CrmContact, User } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Loader2, FileText, Info, CheckCircle2, XCircle, Download, FileAudio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getAppeals } from '@/actions/appeals';
import { findContactByPhone } from '@/actions/crm';
import { CrmEditor } from './crm-editor';
import { Separator } from '@/components/ui/separator';
import { format, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import { canDownloadRecording } from '@/actions/ari';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { AudioPlayer } from './audio-player';
import { CallRowDetails } from '../reports/call-row-details';

interface CallDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  call: Call | null;
  user: User | null;
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

export function CallDetailsDialog({ isOpen, onOpenChange, call, user, isCrmEditable = true }: CallDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'crm'>('details');

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Детали звонка от {call?.callerNumber}</DialogTitle>
          <DialogDescription>
            Подробная информация о звонке, обращении и клиенте.
          </DialogDescription>
        </DialogHeader>
        {call ? (
             <div className="grid grid-cols-[1fr_2px_1fr] gap-x-4 p-4">
                <div className="space-y-4">
                     <h3 className="font-semibold text-lg">Информация о звонке</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <p><strong>Оператор:</strong> {call?.operatorName || 'N/A'}</p>
                        <p><strong>Статус:</strong> {call?.status ? <Badge variant={call.status === 'ANSWERED' ? 'success' : 'destructive'}>{statusMap[call.status] || call.status}</Badge> : 'N/A'}</p>
                        <p><strong>Дата:</strong> {formatDate(call.startTime)}</p>
                        <p><strong>Очередь:</strong> {call?.queue || 'Без очереди'}</p>
                        <p><strong>Время разговора:</strong> {formatDuration(call.billsec)}</p>
                        <p><strong>Время ожидания:</strong> {formatDuration(call.waitTime)}</p>
                    </div>
                </div>
                <Separator orientation="vertical" />
                 <CallRowDetails call={call} user={user} isCrmEditable={isCrmEditable} />
            </div>
        ) : (
             <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

