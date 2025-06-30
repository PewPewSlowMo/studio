'use client';

import type { CrmContact, Call } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { User, Phone, MapPin, BadgeInfo, History, Calendar, X } from 'lucide-react';
import { PhoneIncoming as PhoneIncomingIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';

interface CallerInfoCardProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  contact: CrmContact | null;
  history: Call[];
  callerId: string;
}

export function CallerInfoCard({ isOpen, onOpenChange, contact, history, callerId }: CallerInfoCardProps) {
  
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'dd.MM.yyyy HH:mm', { locale: ru }) : 'Invalid Date';
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <PhoneIncomingIcon className="text-primary" />
            Входящий звонок от {contact?.name || callerId}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Информация о клиенте и история обращений. Примите вызов на вашем софтфоне.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Contact Details */}
          <div className="space-y-4">
             <h3 className="font-semibold border-b pb-2">Данные клиента</h3>
             {contact ? (
                <div className="space-y-3 text-sm">
                   <div className="flex items-center gap-3"><User className="h-4 w-4 text-muted-foreground" /> <span>{contact.name}</span></div>
                   <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /> <span>{contact.phoneNumber}</span></div>
                   <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted-foreground" /> <span>{contact.address}</span></div>
                   <div className="flex items-center gap-3"><BadgeInfo className="h-4 w-4 text-muted-foreground" /> <Badge>{contact.type}</Badge></div>
                </div>
             ) : (
                <div className="text-center text-muted-foreground py-8">
                    <p>Контакт не найден в CRM.</p>
                    <p className="font-bold text-lg">{callerId}</p>
                </div>
             )}
          </div>
          {/* Call History */}
          <div className="space-y-4">
             <h3 className="font-semibold border-b pb-2">История обращений</h3>
             <ScrollArea className="h-48">
                {history.length > 0 ? (
                    <div className="space-y-3 pr-4">
                        {history.map(call => (
                            <div key={call.id} className="text-xs p-2 rounded-md bg-muted/50">
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
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="mr-2 h-4 w-4" /> Закрыть</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
