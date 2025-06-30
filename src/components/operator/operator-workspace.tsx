'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  User as UserIcon,
  X,
  Loader2,
} from 'lucide-react';
import type { User, Call, CrmContact, CallState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { getOperatorState } from '@/actions/asterisk';
import { originateCall, answerCall, hangupCall } from '@/actions/ami';
import { findContactByPhone } from '@/actions/crm';
import { cn } from '@/lib/utils';
import { CallerInfoCard } from './caller-info-card';
import { AppealForm } from './appeal-form';

// --- Prop Types ---
interface OperatorWorkspaceProps {
  user: User;
  amiConnection: { host: string; port: string; username: string; password: string; };
  ariConnection: { host: string; port: string; username: string; password: string; };
}

// --- Sub-components ---
function Dialpad({ onDial, disabled }: { onDial: (number: string) => void, disabled: boolean }) {
  const [number, setNumber] = useState('');
  const buttons = '123456789*0#'.split('');

  const handleInput = (char: string) => setNumber((prev) => prev + char);
  const handleBackspace = () => setNumber((prev) => prev.slice(0, -1));

  const handleDial = () => {
    if (number) {
      onDial(number);
      setNumber('');
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Новый звонок</CardTitle>
        <CardDescription>Введите номер для совершения исходящего вызова.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="Введите номер..."
            className="text-lg h-12 pr-10"
            disabled={disabled}
            onKeyDown={(e) => e.key === 'Enter' && handleDial()}
          />
          {number && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9" onClick={handleBackspace}>
                <X className="h-5 w-5"/>
            </Button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {buttons.map((btn) => (
            <Button key={btn} variant="outline" className="h-16 text-2xl font-bold" onClick={() => handleInput(btn)} disabled={disabled}>
              {btn}
            </Button>
          ))}
        </div>
        <Button onClick={handleDial} className="w-full h-14 bg-green-600 hover:bg-green-700 text-white" disabled={!number || disabled}>
          <PhoneCall className="mr-2" /> Позвонить
        </Button>
      </CardContent>
    </Card>
  );
}

function CallStatus({ state, onAnswer, onHangup, user, isProcessing, isDialogOpen }: { state: CallState, onAnswer: () => void, onHangup: () => void, user: User, isProcessing: boolean, isDialogOpen: boolean }) {
  const statusConfig = {
    offline: { text: 'Оффлайн', color: 'bg-gray-500', icon: PhoneOff },
    available: { text: 'Доступен', color: 'bg-green-500', icon: Phone },
    ringing: { text: 'Входящий звонок', color: 'bg-yellow-500 animate-pulse', icon: PhoneIncoming },
    'on-call': { text: 'В разговоре', color: 'bg-red-500', icon: PhoneCall },
    connecting: { text: 'Соединение...', color: 'bg-blue-500 animate-pulse', icon: Loader2 },
  };

  const currentStatus = statusConfig[state.status];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Статус оператора</CardTitle>
        <CardDescription>Информация о текущем состоянии и вызове.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
                 <UserIcon className="h-5 w-5 text-muted-foreground" />
                 <span className="font-semibold">{user.name} (доб. {user.extension})</span>
            </div>
            <div className="flex items-center gap-2">
                <div className={cn("h-3 w-3 rounded-full", currentStatus.color, currentStatus.icon === Loader2 && 'animate-spin')} />
                <span className="font-medium text-sm">{currentStatus.text}</span>
            </div>
        </div>

        {state.status === 'on-call' && state.callerId && (
            <div className="p-4 text-center rounded-lg border">
                <p className="text-lg font-bold">Вы на линии с:</p>
                <p className="text-3xl font-mono my-2">{state.callerId}</p>
            </div>
        )}
        
        <div className={cn("grid grid-cols-2 gap-4", isDialogOpen && "invisible")}>
            <Button onClick={onAnswer} disabled={state.status !== 'ringing' || isProcessing} className="h-16 bg-green-600 hover:bg-green-700 text-white text-lg">
                <PhoneIncoming className="mr-2" /> Ответить
            </Button>
            <Button onClick={onHangup} disabled={!['on-call', 'connecting', 'ringing'].includes(state.status) || isProcessing} className="h-16 bg-red-600 hover:bg-red-700 text-white text-lg">
                {isProcessing ? <Loader2 className="mr-2 animate-spin" /> : <PhoneOff className="mr-2" />}
                {isProcessing ? 'Завершение...' : 'Завершить'}
            </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Main component ---
export function OperatorWorkspace({ user, amiConnection, ariConnection }: OperatorWorkspaceProps) {
  const [state, setState] = useState<CallState>({ status: 'offline' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [crmContact, setCrmContact] = useState<CrmContact | null>(null);
  const [callHistory, setCallHistory] = useState<Call[]>([]);
  const [isCallerInfoOpen, setIsCallerInfoOpen] = useState(false);
  const [lastCheckedCallerId, setLastCheckedCallerId] = useState<string | null>(null);

  const pollStatus = useCallback(async () => {
    if (!user.extension) return;

    const result = await getOperatorState(ariConnection, user.extension);

    if (result.success && result.data) {
      const { endpointState, channelId, channelName, channelState, callerId } = result.data;
      
      const stateToUse = channelState || endpointState;
      const normalizedState = stateToUse?.toLowerCase();
      
      let newStatus: CallState['status'] = 'available';

      switch (normalizedState) {
        // Channel States
        case 'ring':
        case 'ringing':
          newStatus = 'ringing';
          break;
        case 'up':
        case 'busy':
        case 'offhook':
        case 'dialing':
          newStatus = 'on-call';
          break;
        case 'down':
        case 'rsrvd':
          newStatus = 'available';
          break;

        // Endpoint States (if no channel)
        case 'online':
        case 'not_inuse':
          newStatus = 'available';
          break;
        case 'unavailable':
        case 'invalid':
        case 'offline':
          newStatus = 'offline';
          break;
        
        default:
          newStatus = channelId ? 'on-call' : 'available';
      }

      setState(prevState => ({
        ...prevState,
        status: newStatus,
        channelId: channelId,
        channelName: channelName,
        callerId: newStatus === 'ringing' || newStatus === 'on-call' ? callerId : undefined,
      }));
    } else {
      setState({ status: 'offline' });
      console.error('Polling failed:', result.error);
    }
  }, [ariConnection, user.extension]);

  useEffect(() => {
    pollStatus();
    const intervalId = setInterval(pollStatus, 3000);
    return () => clearInterval(intervalId);
  }, [pollStatus]);

  useEffect(() => {
    const fetchContact = async (callerId: string) => {
        setLastCheckedCallerId(callerId);
        const { contact, history } = await findContactByPhone(callerId);
        setCrmContact(contact);
        setCallHistory(history);
        setIsCallerInfoOpen(true);
    };

    if (state.status === 'ringing' && state.callerId && state.callerId !== lastCheckedCallerId) {
        fetchContact(state.callerId);
    }
    
    if (state.status !== 'ringing' && isCallerInfoOpen) {
        setIsCallerInfoOpen(false);
        setLastCheckedCallerId(null);
    }
  }, [state.status, state.callerId, isCallerInfoOpen, lastCheckedCallerId]);

  const handleDial = async (number: string) => {
    if (!user.extension) return;
    setIsProcessing(true);
    setState(prev => ({ ...prev, status: 'connecting' }));
    const result = await originateCall(amiConnection, user.extension, number);
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Call Failed', description: result.error });
      setState(prev => ({...prev, status: 'available'}));
    }
    await pollStatus();
    setIsProcessing(false);
  };
  
  const handleAnswer = async () => {
    if (!state.channelName) return;
    setIsProcessing(true);
    setIsCallerInfoOpen(false);
    const result = await answerCall(amiConnection, state.channelName);
    if (!result.success) {
       toast({ variant: 'destructive', title: 'Answer Failed', description: result.error });
    }
    await pollStatus();
    setIsProcessing(false);
  };
  
  const handleHangup = async () => {
    if (!state.channelName) return;
    setIsProcessing(true);
    setIsCallerInfoOpen(false);
    const result = await hangupCall(amiConnection, state.channelName);
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Hangup Failed', description: result.error });
    }
    setState({status: 'available'});
    await pollStatus();
    setIsProcessing(false);
  };

  const RightPanel = () => {
    if (state.status === 'on-call' && state.channelId && state.callerId) {
        return <AppealForm 
            callId={state.channelId} 
            callerNumber={state.callerId} 
            operator={user} 
        />;
    }
    return <Dialpad onDial={handleDial} disabled={state.status !== 'available' || isProcessing} />;
  };

  return (
    <>
      <CallerInfoCard 
        isOpen={isCallerInfoOpen}
        onOpenChange={setIsCallerInfoOpen}
        onAnswer={handleAnswer}
        onHangup={handleHangup}
        contact={crmContact}
        history={callHistory}
        callerId={state.callerId || ''}
      />
      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        <div>
          <CallStatus 
              state={state} 
              user={user} 
              onAnswer={handleAnswer} 
              onHangup={handleHangup} 
              isProcessing={isProcessing}
              isDialogOpen={isCallerInfoOpen}
          />
        </div>
        <div>
          <RightPanel />
        </div>
      </div>
    </>
  );
}
