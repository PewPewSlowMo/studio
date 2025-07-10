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
import { getConfig } from '@/actions/config';
import { checkRecordingExists, getRecording, canDownloadRecording } from '@/actions/ari';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { AudioPlayer } from './audio-player';

interface CallDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  call: Call | null;
  user: User | null;
  isCrmEditable?: boolean;
}

type RecordingStatus = 'checking' | 'exists' | 'not_found' | 'loading' | 'loaded' | 'error';

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
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [contact, setContact] = useState<CrmContact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('checking');
  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      if (!call) return;
      setIsLoading(true);
      setRecordingStatus('checking');
      setAudioDataUri(null);

      try {
        const config = await getConfig();

        const [appealsResult, contactResult, recordingCheckResult] = await Promise.all([
          getAppeals(),
          findContactByPhone(call.callerNumber),
          checkRecordingExists(config.ari, call.id),
        ]);
        
        const foundAppeal = appealsResult.find(a => a.callId === call.id) || null;
        setAppeal(foundAppeal);

        if (contactResult.contact) {
            setContact(contactResult.contact);
        } else {
            setContact(null);
        }
        
        if (recordingCheckResult.success) {
            setRecordingStatus(recordingCheckResult.exists ? 'exists' : 'not_found');
        } else {
            setRecordingStatus('error');
        }

      } catch (error) {
        console.error("Failed to fetch call details:", error);
        setRecordingStatus('error');
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

  const handleFetchRecording = async () => {
    if (!call) return;
    setRecordingStatus('loading');
    try {
      const config = await getConfig();
      const result = await getRecording(config.ari, call.id);
      if (result.success && result.dataUri) {
        setAudioDataUri(result.dataUri);
        setRecordingStatus('loaded');
      } else {
        setRecordingStatus('error');
        toast({ variant: 'destructive', title: 'Ошибка', description: result.error || 'Не удалось загрузить запись.' });
      }
    } catch (error) {
        setRecordingStatus('error');
        toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось загрузить запись.' });
    }
  };

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

            <div className="space-y-2">
                <h3 className="font-semibold text-lg">Запись разговора</h3>
                 <div className="p-3 bg-muted rounded-md min-h-[60px] flex items-center justify-between">
                    {recordingStatus === 'checking' && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin h-4 w-4" /> Проверка наличия...</div>}
                    {recordingStatus === 'exists' && (
                        <>
                            <div className="flex items-center gap-2 text-green-600 font-medium"><CheckCircle2 /> Запись найдена</div>
                            <Button onClick={handleFetchRecording} size="sm"><FileAudio className="mr-2 h-4 w-4" /> Загрузить запись</Button>
                        </>
                    )}
                     {recordingStatus === 'loading' && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin h-4 w-4" /> Загрузка записи...</div>}
                     {recordingStatus === 'loaded' && audioDataUri && (
                        <div className="w-full">
                            <AudioPlayer 
                                src={audioDataUri} 
                                canDownload={canDownloadRecording(user?.role)}
                                fileName={`recording-${call?.id}.wav`}
                            />
                        </div>
                    )}
                    {recordingStatus === 'not_found' && <div className="flex items-center gap-2 text-red-600 font-medium"><XCircle /> Запись отсутствует</div>}
                    {recordingStatus === 'error' && <div className="flex items-center gap-2 text-red-600 font-medium"><XCircle /> Ошибка получения записи</div>}
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
