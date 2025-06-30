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
  const [activeCallData, setActiveCallData] = useState<{
    uniqueId: string;
    channelId: string;
    callerNumber: string;
    queue?: string;
  } | null>(null);

  const [crmContact, setCrmContact] = useState<CrmContact | null>(null);
  const [callHistory, setCallHistory] = useState<Call[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const previousStatusRef = useRef<string | null>(null);
  const lastCheckedCallerIdRef = useRef<string | null>(null);

  // This effect handles polling for the operator's status.
  useEffect(() => {
    const poll = async () => {
        if (!user.extension) return;

        const result = await getOperatorState(ariConnection, user.extension);
        let newStatus: CallState['status'] = 'offline';
        let newCallStateData: Partial<CallState> = {};
        
        if (result.success && result.data) {
            const { endpointState, channelId, channelName, callerId, queue, uniqueId } = result.data;
            newStatus = endpointState as CallState['status'] || 'offline';
            newCallStateData = { channelId, channelName, callerId, queue, uniqueId };
        } else {
            console.error('Polling failed:', result.error);
        }

        setCallState(prevState => {
            const newState = { ...prevState, status: newStatus, ...newCallStateData };
            // Only update state if something has actually changed to prevent re-renders
            if (prevState.status !== newState.status || prevState.callerId !== newState.callerId || prevState.uniqueId !== newState.uniqueId) {
                return newState as CallState;
            }
            return prevState;
        });
    };

    poll();
    const intervalId = setInterval(poll, 2000);
    return () => clearInterval(intervalId);
  }, [user.extension, ariConnection]);

  // This effect reacts to changes in `callState` to manage the UI state (modal, wrap-up, etc.)
  useEffect(() => {
    const currentStatus = callState.status;
    const prevStatus = previousStatusRef.current;
    
    // Call has just ended: transition from 'on-call' to something else.
    if (prevStatus === 'on-call' && currentStatus !== 'on-call' && activeCallData) {
        setIsWrapUp(true);
        // The modal is kept open by `isWrapUp` being true
        return;
    }
    
    // An active call is happening (ringing or established)
    if ((currentStatus === 'ringing' || currentStatus === 'on-call') && callState.uniqueId && callState.channelId && callState.callerId) {
        setIsWrapUp(false); // A new call starts, so wrap-up must be false.
        setIsModalOpen(true);
        
        // Update active call data only if it's a new call (different uniqueId)
        if (activeCallData?.uniqueId !== callState.uniqueId) {
             setActiveCallData({
                 uniqueId: callState.uniqueId,
                 channelId: callState.channelId,
                 callerNumber: callState.callerId,
                 queue: callState.queue,
             });
        }
        
        // Fetch CRM data only once per new caller ID
        if (callState.callerId && lastCheckedCallerIdRef.current !== callState.callerId) {
            lastCheckedCallerIdRef.current = callState.callerId;
            findContactByPhone(callState.callerId).then(({ contact, history }) => {
                setCrmContact(contact);
                setCallHistory(history);
            });
        }
    } else if (!isWrapUp) {
        // No call is active and we are not in wrap-up time, so close everything.
        setIsModalOpen(false);
        setActiveCallData(null);
        lastCheckedCallerIdRef.current = null;
    }

    // Update the ref for the next render cycle.
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
            callState={{
              callId: activeCallData.uniqueId,
              callerNumber: activeCallData.callerNumber,
              queue: activeCallData.queue,
              status: callState.status,
              uniqueId: activeCallData.uniqueId
            }}
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
