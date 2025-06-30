'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Phone, User as UserIcon } from 'lucide-react';
import type { User, Call, CrmContact, CallState } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getOperatorState } from '@/actions/asterisk';
import { findContactByPhone } from '@/actions/crm';
import { cn } from '@/lib/utils';
import { CallerInfoCard } from './caller-info-card';
import { addOrUpdateContact } from '@/actions/crm';

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
  const [isWrapUp, setIsWrapUp] = useState(false);
  const [activeCallData, setActiveCallData] = useState<{ callId: string; callerNumber: string, queue?: string } | null>(null);

  const [crmContact, setCrmContact] = useState<CrmContact | null>(null);
  const [callHistory, setCallHistory] = useState<Call[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const lastCheckedCallerIdRef = useRef<string | null>(null);
  const previousStatusRef = useRef<string | null>(null);

  const pollStatus = useCallback(async () => {
    if (!user.extension) return;

    const result = await getOperatorState(ariConnection, user.extension);
    let newStatus: CallState['status'] = 'offline';
    let newChannelId: string | undefined, newChannelName: string | undefined, newCallerId: string | undefined;

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
    
    // This check prevents unnecessary state updates and re-renders
    if (newStatus !== callState.status || newCallerId !== callState.callerId) {
        setCallState({ status: newStatus, channelId: newChannelId, channelName: newChannelName, callerId: newCallerId });
    }
  }, [user.extension, ariConnection, callState.status, callState.callerId]);


  useEffect(() => {
    pollStatus();
    const intervalId = setInterval(pollStatus, 2000);
    return () => clearInterval(intervalId);
  }, [pollStatus]);

  useEffect(() => {
    const currentStatus = callState.status;
    const prevStatus = previousStatusRef.current;

    // Transition from on-call to something else -> start wrap-up
    if (prevStatus === 'on-call' && currentStatus !== 'on-call' && activeCallData) {
      setIsWrapUp(true);
      setIsModalOpen(true); // Keep modal open for wrap-up
    } else if (currentStatus === 'ringing' || currentStatus === 'on-call') {
      setIsModalOpen(true);
      if (callState.callerId && lastCheckedCallerIdRef.current !== callState.callerId) {
        lastCheckedCallerIdRef.current = callState.callerId;
        findContactByPhone(callState.callerId).then(({ contact, history }) => {
          setCrmContact(contact);
          setCallHistory(history);
        });
      }
      if (callState.channelId && callState.callerId) {
          setActiveCallData({ callId: callState.channelId, callerNumber: callState.callerId, queue: callState.queue });
      }
    } else if (!isWrapUp) {
      setIsModalOpen(false);
      lastCheckedCallerIdRef.current = null;
      setActiveCallData(null);
    }
    
    previousStatusRef.current = currentStatus;
  }, [callState, isWrapUp, activeCallData]);


  const handleCloseModal = () => {
    setIsWrapUp(false);
    setIsModalOpen(false);
    setActiveCallData(null);
    lastCheckedCallerIdRef.current = null;
    setCrmContact(null);
    setCallHistory([]);
  };

  const handleContactUpdate = (updatedContact: CrmContact) => {
    setCrmContact(updatedContact);
    // No need to call the server again, just update state
  }
  
  return (
    <>
      {isModalOpen && activeCallData && (
          <CallerInfoCard
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            contact={crmContact}
            onContactUpdate={handleContactUpdate}
            history={callHistory}
            callState={{...activeCallData, status: callState.status}}
            operator={user}
            isWrapUp={isWrapUp}
          />
      )}

      <div className="space-y-8 max-w-5xl mx-auto">
        <OperatorStatusCard user={user} status={isWrapUp ? 'wrap-up' : callState.status} />
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
      </div>
    </>
  );
}
