'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Phone, PhoneCall, PhoneIncoming, PhoneOff, User as UserIcon, X, Loader2 } from 'lucide-react';
import type { User, Call, CrmContact, CallState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { getOperatorState } from '@/actions/asterisk';
import { originateCall } from '@/actions/ami';
import { findContactByPhone } from '@/actions/crm';
import { cn } from '@/lib/utils';
import { CallerInfoCard } from './caller-info-card';
import { AppealForm } from './appeal-form';

// --- Prop Types ---
interface OperatorWorkspaceProps {
  user: User;
  amiConnection: { host: string; port: string; username: string; password: string };
  ariConnection: { host: string; port: string; username: string; password: string };
}

// --- Sub-components ---
function Dialpad({ onDial, disabled }: { onDial: (number: string) => void; disabled: boolean }) {
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
              <X className="h-5 w-5" />
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

function OperatorStatusCard({ user, status }: { user: User; status: CallState['status'] | 'wrap-up' }) {
  const statusConfig = {
    offline: { text: 'Оффлайн', color: 'bg-gray-500' },
    available: { text: 'Доступен', color: 'bg-green-500' },
    ringing: { text: 'Входящий звонок', color: 'bg-yellow-500 animate-pulse' },
    'on-call': { text: 'В разговоре', color: 'bg-red-500' },
    connecting: { text: 'Соединение...', color: 'bg-blue-500' },
    'wrap-up': { text: 'Пост-обработка', color: 'bg-indigo-500' },
  };

  const currentStatus = statusConfig[status] || statusConfig.offline;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Статус оператора</CardTitle>
        <CardDescription>Ваше текущее состояние в системе.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
          <div className="flex items-center gap-3">
            <UserIcon className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold">
              {user.name} (доб. {user.extension})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('h-3 w-3 rounded-full', currentStatus.color)} />
            <span className="font-medium text-sm">{currentStatus.text}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main component ---
export function OperatorWorkspace({ user, amiConnection, ariConnection }: OperatorWorkspaceProps) {
  const [callState, setCallState] = useState<CallState>({ status: 'offline' });
  const [isWrapUp, setIsWrapUp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeCallData, setActiveCallData] = useState<{ callId: string; callerNumber: string } | null>(null);

  // For caller info pop-up
  const [crmContact, setCrmContact] = useState<CrmContact | null>(null);
  const [callHistory, setCallHistory] = useState<Call[]>([]);
  const [isCallerInfoOpen, setIsCallerInfoOpen] = useState(false);
  const [lastCheckedCallerId, setLastCheckedCallerId] = useState<string | null>(null);

  const previousStatusRef = useRef<CallState['status']>();

  const pollStatus = useCallback(async () => {
    if (!user.extension) return;

    const result = await getOperatorState(ariConnection, user.extension);
    let newStatus: CallState['status'] = 'offline';
    let newChannelId, newChannelName, newCallerId;

    if (result.success && result.data) {
      const { endpointState, channelId, channelName, channelState, callerId } = result.data;
      newChannelId = channelId;
      newChannelName = channelName;
      newCallerId = callerId;

      const stateToUse = channelState || endpointState;
      const normalizedState = stateToUse?.toLowerCase();

      switch (normalizedState) {
        case 'ring':
        case 'ringing':
          newStatus = 'ringing';
          break;
        case 'up': case 'busy': case 'offhook': case 'dialing':
          newStatus = 'on-call';
          break;
        case 'down': case 'rsrvd': case 'online': case 'not_inuse': case 'not in use':
          newStatus = 'available';
          break;
        case 'unavailable': case 'invalid': case 'offline':
          newStatus = 'offline';
          break;
        default:
          newStatus = channelId ? 'on-call' : 'available';
      }
    } else {
      console.error('Polling failed:', result.error);
    }

    const newState = { status: newStatus, channelId: newChannelId, channelName: newChannelName, callerId: newCallerId };
    
    setCallState((currentState) => {
      if (
        currentState.status === newState.status &&
        currentState.channelId === newState.channelId &&
        currentState.callerId === newState.callerId
      ) {
        return currentState;
      }
      return newState;
    });
  }, [user.extension, ariConnection]);

  useEffect(() => {
    if (previousStatusRef.current === 'on-call' && callState.status !== 'on-call' && activeCallData) {
      setIsWrapUp(true);
    } else if (callState.status === 'on-call' && callState.channelId && callState.callerId) {
      setActiveCallData({ callId: callState.channelId, callerNumber: callState.callerId });
      setIsWrapUp(false);
    } else if (callState.status !== 'on-call' && !isWrapUp) {
      setActiveCallData(null);
    }
    previousStatusRef.current = callState.status;
  }, [callState, activeCallData, isWrapUp]);


  useEffect(() => {
    pollStatus();
    const intervalId = setInterval(pollStatus, 3000);
    return () => clearInterval(intervalId);
  }, [pollStatus]);

  // This effect handles opening and closing the CallerInfoCard.
  // It is written to prevent state update loops.
  useEffect(() => {
    const fetchContactAndOpen = async (callerId: string) => {
      const { contact, history } = await findContactByPhone(callerId);
      setCrmContact(contact);
      setCallHistory(history);
      setIsCallerInfoOpen(true);
    };

    if (callState.status === 'ringing' && callState.callerId) {
      // Use functional update for lastCheckedCallerId to avoid having it in the deps array
      // and to get the most recent value to prevent re-fetching.
      setLastCheckedCallerId(prevId => {
        if (prevId !== callState.callerId) {
          fetchContactAndOpen(callState.callerId!);
        }
        return callState.callerId;
      });
    } else {
      // If not ringing, ensure the dialog is closed and the ID is reset.
      setIsCallerInfoOpen(false);
      setLastCheckedCallerId(null);
    }
  }, [callState.status, callState.callerId]);

  const handleDial = async (number: string) => {
    if (!user.extension) return;
    setIsProcessing(true);
    setCallState((prev) => ({ ...prev, status: 'connecting' }));
    const result = await originateCall(amiConnection, user.extension, number);
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Call Failed', description: result.error });
      setCallState((prev) => ({ ...prev, status: 'available' }));
    }
    await pollStatus();
    setIsProcessing(false);
  };

  const handleWrapUpEnd = () => {
    setIsWrapUp(false);
    setActiveCallData(null);
  };

  const RightPanel = () => {
    if (activeCallData) {
      return (
        <AppealForm
          callId={activeCallData.callId}
          callerNumber={activeCallData.callerNumber}
          operator={user}
          isWrapUp={isWrapUp}
          onWrapUpEnd={handleWrapUpEnd}
        />
      );
    }
    return <Dialpad onDial={handleDial} disabled={callState.status !== 'available' || isProcessing} />;
  };

  return (
    <>
      <CallerInfoCard
        isOpen={isCallerInfoOpen}
        onOpenChange={setIsCallerInfoOpen}
        contact={crmContact}
        history={callHistory}
        callerId={callState.callerId || ''}
      />
      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        <div>
          <OperatorStatusCard user={user} status={isWrapUp ? 'wrap-up' : callState.status} />
        </div>
        <div>
          <RightPanel />
        </div>
      </div>
    </>
  );
}
