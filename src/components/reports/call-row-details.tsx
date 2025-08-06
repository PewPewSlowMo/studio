'use client';

import { useState, useEffect } from 'react';
import type { Call, Appeal, CrmContact, User } from '@/lib/types';
import { Loader2, Info, CheckCircle2, XCircle, FileAudio, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getAppeals } from '@/actions/appeals';
import { findContactByPhone } from '@/actions/crm';
import { CrmEditor } from '@/components/operator/crm-editor';
import { Separator } from '@/components/ui/separator';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { AudioPlayer } from '@/components/operator/audio-player';

interface CallRowDetailsProps {
  call: Call;
  user: User | null;
  isCrmEditable?: boolean;
}

type RecordingStatus = 'checking' | 'exists' | 'not_found' | 'loading' | 'loaded' | 'error';


export function CallRowDetails({ call, user, isCrmEditable = true }: CallRowDetailsProps) {
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [contact, setContact] = useState<CrmContact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
        const [allAppeals, contactResult] = await Promise.all([
          getAppeals(),
          findContactByPhone(call.callerNumber),
        ]);
        
        // Flexible search for appeal
        const callIdBase = call.id.includes('.') ? call.id.substring(0, call.id.lastIndexOf('.')) : call.id;
        const foundAppeal = allAppeals.find(a => a.callId.startsWith(callIdBase)) || null;

        setAppeal(foundAppeal);
        setContact(contactResult.contact || null);

        // Recording check is now just a check if `recordingfile` exists in the CDR data
        if (call.recordingfile && call.recordingfile.length > 0) {
            setRecordingStatus('exists');
        } else {
            setRecordingStatus('not_found');
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error("Failed to fetch call details:", error);
        setRecordingStatus('error');
        toast({ variant: 'destructive', title: 'Ошибка загрузки деталей', description: message });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [call, toast]);
  
  const handleSaveContact = (savedContact: CrmContact) => {
      setContact(savedContact);
  }

  const handleFetchRecording = async () => {
    if (!call?.id) return;
    setRecordingStatus('loading');
    
    try {
      const response = await fetch(`/api/recordings/${call.id}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.details || errorText;
        } catch (e) {
          // It's not JSON, use the plain text. This is expected for HTML error pages.
        }
        throw new Error(errorMessage);
      }

      const audioBlob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setAudioDataUri(reader.result as string);
        setRecordingStatus('loaded');
      };
      reader.readAsDataURL(audioBlob);

    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        setRecordingStatus('error');
        toast({ variant: 'destructive', title: 'Ошибка получения записи', description: message });
    }
  };

  const priorityMap: Record<any, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
  const satisfactionMap: Record<any, string> = { yes: 'Да', no: 'Нет' };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48 bg-muted/50">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-muted/50 p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recording and Appeal */}
        <div className="space-y-4">
             <div className="space-y-2">
                <h3 className="font-semibold text-base">Запись разговора</h3>
                 <div className="p-3 bg-background rounded-md min-h-[60px] flex items-center justify-between shadow-sm">
                    {recordingStatus === 'checking' && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin h-4 w-4" /> Проверка наличия...</div>}
                    {recordingStatus === 'exists' && (
                        <>
                            <div className="flex items-center gap-2 text-green-600 font-medium"><CheckCircle2 /> Запись найдена</div>
                            <Button onClick={handleFetchRecording} size="sm" variant="outline"><FileAudio className="mr-2 h-4 w-4" /> Прослушать</Button>
                        </>
                    )}
                     {recordingStatus === 'loading' && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin h-4 w-4" /> Загрузка записи...</div>}
                     {recordingStatus === 'loaded' && audioDataUri && (
                        <div className="w-full">
                            <AudioPlayer 
                                src={audioDataUri} 
                                // Simplified canDownload logic for now
                                canDownload={user?.role === 'admin' || user?.role === 'supervisor'}
                                fileName={`${call.recordingfile}`}
                            />
                        </div>
                    )}
                    {recordingStatus === 'not_found' && <div className="flex items-center gap-2 text-red-600 font-medium"><XCircle /> Запись отсутствует в CDR</div>}
                    {recordingStatus === 'error' && <div className="flex items-center gap-2 text-red-600 font-medium"><XCircle /> Ошибка получения записи</div>}
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="font-semibold text-base flex items-center gap-2"><FileText className="h-5 w-5" /> Детали обращения</h3>
                <div className="p-3 bg-background rounded-md shadow-sm">
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
                       <p className="p-2 bg-muted rounded-md text-xs">{appeal.description}</p>
                       <p><strong>Решение:</strong></p>
                       <p className="p-2 bg-muted rounded-md text-xs capitalize">{appeal.resolution || 'Не указано'}</p>
                       {appeal.notes && <>
                         <p><strong>Доп. заметки:</strong></p>
                         <p className="p-2 bg-muted rounded-md text-xs">{appeal.notes}</p>
                       </>}
                    </div>
                ): (
                    <div className="text-center text-muted-foreground p-4">
                        <Info className="mx-auto h-6 w-6 mb-2" />
                        <p className="text-sm">Для этого звонка не было создано карточки обращения.</p>
                    </div>
                )}
                </div>
            </div>
        </div>

        {/* Right Column: CRM */}
        <div className="space-y-2">
             <h3 className="font-semibold text-base">Данные клиента</h3>
             <div className="p-3 bg-background rounded-md shadow-sm">
                 <CrmEditor
                    contact={contact}
                    phoneNumber={call?.callerNumber || ''}
                    onSave={handleSaveContact}
                    isEditable={isCrmEditable}
                />
            </div>
        </div>
    </div>
  );
}
