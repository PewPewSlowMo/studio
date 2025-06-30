'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Phone, User as UserIcon } from 'lucide-react';
import type { User, Call, CrmContact, CallState } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getOperatorState } from '@/actions/asterisk';
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
  const [previousCallState, setPreviousCallState] = useState<CallState>({ status: 'offline' });
  const [isWrapUp, setIsWrapUp] = useState(false);
  const [activeCallData, setActiveCallData] = useState<{ callId: string; callerNumber: string } | null>(null);

  // For caller info pop-up
  const [crmContact, setCrmContact] = useState<CrmContact | null>(null);
  const [callHistory, setCallHistory] = useState<Call[]>([]);
  const [isCallerInfoOpen, setIsCallerInfoOpen] = useState(false);
  const lastCheckedCallerIdRef = useRef<string | null>(null);

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
    
    setCallState(currentState => {
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
    pollStatus();
    const intervalId = setInterval(pollStatus, 2000); // Poll every 2 seconds
    return () => clearInterval(intervalId);
  }, [pollStatus]);

  useEffect(() => {
    if (callState.status !== previousCallState.status || callState.channelId !== previousCallState.channelId) {
      // Transition from on-call to something else
      if (previousCallState.status === 'on-call' && callState.status !== 'on-call' && activeCallData) {
        setIsWrapUp(true);
      } 
      // Transition to on-call
      else if (callState.status === 'on-call' && callState.channelId && callState.callerId) {
        setActiveCallData({ callId: callState.channelId, callerNumber: callState.callerId });
        setIsWrapUp(false);
      }
      // Transition to not on-call and not in wrap-up
      else if (callState.status !== 'on-call' && !isWrapUp) {
        setActiveCallData(null);
      }

      setPreviousCallState(callState);
    }
  }, [callState, previousCallState, activeCallData, isWrapUp]);


  useEffect(() => {
    const fetchContactAndOpen = async (callerId: string) => {
        if (lastCheckedCallerIdRef.current === callerId) return;

        lastCheckedCallerIdRef.current = callerId;
        const { contact, history } = await findContactByPhone(callerId);
        setCrmContact(contact);
        setCallHistory(history);
        setIsCallerInfoOpen(true);
    };

    if (callState.status === 'ringing' && callState.callerId) {
        fetchContactAndOpen(callState.callerId);
    } else {
        if (isCallerInfoOpen) {
            setIsCallerInfoOpen(false);
        }
        lastCheckedCallerIdRef.current = null;
    }
  }, [callState, isCallerInfoOpen]);


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
    return (
        <Card>
            <CardHeader>
                <CardTitle>Рабочее место</CardTitle>
                <CardDescription>Ожидание следующего звонка...</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center text-muted-foreground p-8">
                    <Phone className="h-16 w-16 mx-auto mb-4" />
                    <p>Система готова к приему звонков.</p>
                </div>
            </CardContent>
        </Card>
    );
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
