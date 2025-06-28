'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  User as UserIcon,
  Clock,
  Circle,
  X,
  Loader2,
} from 'lucide-react';
import type { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  getEndpointDetails,
  originateCall,
  answerCall,
  hangupCall,
} from '@/actions/ami';
import { cn } from '@/lib/utils';

interface OperatorWorkspaceProps {
  user: User;
  connection: {
    host: string;
    port: string;
    username: string;
    password: string;
  };
}

interface CallState {
  status: 'offline' | 'available' | 'ringing' | 'on-call' | 'connecting';
  channel?: string;
  callerId?: string;
}

// Sub-components within the same file for simplicity
function Dialpad({ onDial, disabled }: { onDial: (number: string) => void, disabled: boolean }) {
  const [number, setNumber] = useState('');
  const buttons = '123456789*0#'.split('');

  const handleInput = (char: string) => {
    setNumber((prev) => prev + char);
  };
  
  const handleBackspace = () => {
    setNumber((prev) => prev.slice(0, -1));
  }

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
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="Введите номер..."
            className="text-lg h-12 pr-10"
            disabled={disabled}
          />
          {number && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9" onClick={handleBackspace}>
                <X className="h-5 w-5"/>
            </Button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {buttons.map((btn) => (
            <Button
              key={btn}
              variant="outline"
              className="h-16 text-2xl font-bold"
              onClick={() => handleInput(btn)}
              disabled={disabled}
            >
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

function CallStatus({ state, onAnswer, onHangup, user, isProcessing }: { state: CallState, onAnswer: () => void, onHangup: () => void, user: User, isProcessing: boolean }) {
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
                <div className={cn("h-3 w-3 rounded-full", currentStatus.color)} />
                <span className="font-medium text-sm">{currentStatus.text}</span>
            </div>
        </div>

        {state.status === 'ringing' && (
            <div className="p-4 text-center rounded-lg border-2 border-dashed border-yellow-500">
                <p className="text-lg font-bold text-yellow-600">Входящий от:</p>
                <p className="text-3xl font-mono my-2">{state.callerId || 'Неизвестный номер'}</p>
            </div>
        )}

        {state.status === 'on-call' && (
            <div className="p-4 text-center rounded-lg border">
                <p className="text-lg font-bold">Вы на линии с:</p>
                <p className="text-3xl font-mono my-2">{state.callerId || 'Неизвестный номер'}</p>
            </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
            <Button 
                onClick={onAnswer} 
                disabled={state.status !== 'ringing' || isProcessing}
                className="h-16 bg-green-600 hover:bg-green-700 text-white text-lg">
                <PhoneIncoming className="mr-2" /> Ответить
            </Button>
             <Button 
                onClick={onHangup} 
                disabled={!['ringing', 'on-call', 'connecting'].includes(state.status) || isProcessing}
                className="h-16 bg-red-600 hover:bg-red-700 text-white text-lg">
                {isProcessing ? <Loader2 className="mr-2 animate-spin" /> : <PhoneOff className="mr-2" />}
                {isProcessing ? 'Завершение...' : 'Завершить'}
            </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Main component
export function OperatorWorkspace({ user, connection }: OperatorWorkspaceProps) {
  const [state, setState] = useState<CallState>({ status: 'offline' });
  const [isProcessing, setIsProcessing] = useState(false);

  const pollStatus = useCallback(async () => {
    if (!user.extension) return;
    
    try {
      const result = await getEndpointDetails(connection, user.extension);
      if (result.success && result.data) {
        const endpoint = result.data;
        const deviceState = endpoint.state.toLowerCase();
        
        let newStatus: CallState['status'] = 'available';
        if (deviceState.includes('unavailable') || deviceState.includes('invalid')) {
            newStatus = 'offline';
        } else if (deviceState.includes('ringing')) {
            newStatus = 'ringing';
        } else if (deviceState.includes('in use') || deviceState.includes('busy')) {
            newStatus = 'on-call';
        }

        // Simplistic way to get channel and caller ID, a real implementation might need more complex event parsing
        const channel = endpoint.channel_ids.length > 0 ? endpoint.channel_ids[0] : undefined;
        // PJSIPShowEndpoints doesn't provide CallerID, so we keep the old one if the channel is the same.
        const callerId = channel === state.channel ? state.callerId : (channel ? 'Unknown' : undefined);

        setState(prevState => ({ ...prevState, status: newStatus, channel, callerId }));
      } else {
        setState({ status: 'offline' });
      }
    } catch (error) {
       console.error("Polling failed:", error);
       setState({ status: 'offline' });
    }
  }, [connection, user.extension, state.channel, state.callerId]);

  useEffect(() => {
    pollStatus(); // Initial poll
    const intervalId = setInterval(pollStatus, 3000);
    return () => clearInterval(intervalId);
  }, [pollStatus]);

  const handleDial = async (number: string) => {
    if (!user.extension) return;
    setIsProcessing(true);
    setState(prev => ({ ...prev, status: 'connecting' }));
    const result = await originateCall(connection, user.extension, number);
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Call Failed', description: result.error });
      setState(prev => ({...prev, status: 'available'}));
    }
    // Status will update via polling
    setIsProcessing(false);
  };
  
  const handleAnswer = async () => {
    if (!state.channel) return;
    setIsProcessing(true);
    const result = await answerCall(connection, state.channel);
    if (!result.success) {
       toast({ variant: 'destructive', title: 'Answer Failed', description: result.error });
    }
     // Status will update via polling
    setIsProcessing(false);
  };
  
  const handleHangup = async () => {
    if (!state.channel) return;
    setIsProcessing(true);
    const result = await hangupCall(connection, state.channel);
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Hangup Failed', description: result.error });
    }
    setState({status: 'available'}); // Immediately update UI for responsiveness
    setIsProcessing(false);
  };

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
      <div>
        <CallStatus 
            state={state} 
            user={user} 
            onAnswer={handleAnswer} 
            onHangup={handleHangup} 
            isProcessing={isProcessing}
        />
      </div>
      <div>
        <Dialpad onDial={handleDial} disabled={state.status !== 'available' || isProcessing} />
      </div>
    </div>
  );
}
