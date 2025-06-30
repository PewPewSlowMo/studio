'use client';

import { useState, useEffect, useRef } from 'react';
import type { CrmContact, Call, User } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { User as UserIcon, Phone, MapPin, BadgeInfo, History, Calendar, X, Clock, ChevronsRight, Save, Loader2, Mail, PhoneIncoming as PhoneIncomingIcon, Building } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AppealForm, appealFormSchema, type AppealFormValues } from './appeal-form';
import { CrmContactForm, crmContactFormSchema, type CrmContactFormValues } from './crm-contact-form';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

const WRAP_UP_SECONDS = 60;

interface ActiveCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: CrmContact | null;
  onContactUpdate: (contact: CrmContact) => void;
  history: Call[];
  callState: {
    status: string;
    callerNumber?: string;
    callId?: string;
    queue?: string;
  };
  operator: User;
  isWrapUp: boolean;
}

export function CallerInfoCard({ isOpen, onClose, contact, onContactUpdate, history, callState, operator, isWrapUp }: ActiveCallModalProps) {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(WRAP_UP_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const appealForm = useForm<AppealFormValues>({
    resolver: zodResolver(appealFormSchema),
    defaultValues: {
      description: '',
      resolution: '',
      category: 'info',
      priority: 'medium',
      satisfaction: 'n/a',
      notes: '',
      followUp: false,
    },
  });

  const crmForm = useForm<CrmContactFormValues>({
      resolver: zodResolver(crmContactFormSchema),
      defaultValues: { name: '', address: '', type: 'иной', email: '' },
  });

  const handleAutoSubmit = async () => {
    const values = appealForm.getValues();
    if (!values.description || !values.category) {
      toast({
        title: 'Автосохранение отменено',
        description: 'Недостаточно данных для сохранения обращения (описание и категория обязательны).',
        variant: 'destructive'
      });
      onClose();
      return;
    }
    await appealForm.handleSubmit(onValidAppealSubmit)();
  };
  
  useEffect(() => {
    if (isWrapUp && isOpen) {
      setTimeLeft(WRAP_UP_SECONDS);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeLeft(WRAP_UP_SECONDS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWrapUp, isOpen]);

  useEffect(() => {
    if (contact) {
      crmForm.reset({
        name: contact.name,
        address: contact.address,
        // @ts-ignore
        type: contact.type,
        email: contact.email || '',
      });
    } else {
      crmForm.reset({ name: '', address: '', type: 'иной', email: '' });
    }
  }, [contact, crmForm]);

  const onValidAppealSubmit = () => {
    appealForm.reset();
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'dd.MM.yyyy HH:mm', { locale: ru }) : 'Invalid Date';
  }
  
  const callDuration = '00:00'; // Placeholder

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-4xl p-0">
        <div className="flex items-center justify-between p-4 border-b">
           <AlertDialogTitle className="flex items-center gap-3">
              <PhoneIncomingIcon className="text-primary" />
              <span>Входящий звонок</span>
              <Badge variant="outline">{callDuration}</Badge>
           </AlertDialogTitle>
           <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
               <X className="h-4 w-4" />
           </Button>
        </div>
        
        {isWrapUp && (
          <div className="px-4 pt-2 space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Время на пост-обработку</span>
              </div>
              <span className="font-mono font-semibold">{timeLeft}с</span>
            </div>
            <Progress value={(timeLeft / WRAP_UP_SECONDS) * 100} className="h-2" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 px-4 pb-4">
          {/* Left Column */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Информация о звонящем</h3>
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg text-sm">
                <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /> <span>{callState.callerNumber}</span></div>
                <div className="flex items-center gap-3"><Building className="h-4 w-4 text-muted-foreground" /> <span>Регион: <span className="text-foreground">Не определен</span></span></div>
                <div className="flex items-center gap-3"><Clock className="h-4 w-4 text-muted-foreground" /> <span>Время: {format(new Date(), 'dd.MM.yyyy, HH:mm:ss')}</span></div>
                <div className="flex items-center gap-3"><ChevronsRight className="h-4 w-4 text-muted-foreground" /> <span>Очередь: {callState.queue || 'Основная'}</span></div>
            </div>

            <Separator />
            
            <h4 className="font-semibold">Данные клиента</h4>
            {contact ? (
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg text-sm">
                   <div className="flex items-center gap-3"><UserIcon className="h-4 w-4 text-muted-foreground" /> <span>{contact.name}</span></div>
                   <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /> <span>{contact.email || 'Нет данных'}</span></div>
                   <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted-foreground" /> <span>{contact.address}</span></div>
                   <div className="flex items-center gap-3"><BadgeInfo className="h-4 w-4 text-muted-foreground" /> <Badge className="capitalize">{contact.type}</Badge></div>
                </div>
            ) : (
                <CrmContactForm form={crmForm} phoneNumber={callState.callerNumber || ''} onSave={onContactUpdate} />
            )}
            
            <Separator />
            <h4 className="font-semibold">История звонков</h4>
             <ScrollArea className="h-32">
                {history.length > 0 ? (
                    <div className="space-y-2 pr-4 text-xs">
                        {history.map(call => (
                            <div key={call.id} className="p-2 rounded-md bg-muted/50">
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {formatDate(call.startTime)}</span>
                                    <Badge variant={call.status === 'ANSWERED' ? 'success' : 'destructive'}>{call.status}</Badge>
                                </div>
                                <p className="text-muted-foreground mt-1">Оператор: {call.operatorName || 'N/A'}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-8">
                        <History className="h-8 w-8 mx-auto mb-2" />
                        <p>Нет предыдущих обращений.</p>
                    </div>
                )}
             </ScrollArea>
          </div>
          {/* Right Column */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Детали звонка</h3>
            <AppealForm 
                form={appealForm}
                callId={callState.callId || 'n/a'}
                callerNumber={callState.callerNumber || 'n/a'}
                operator={operator}
                isWrapUp={isWrapUp}
                onFormSubmit={onValidAppealSubmit}
            />
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
