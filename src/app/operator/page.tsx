
'use client';

import { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
import type { User, Call, CrmContact, CallState, AppConfig, Appeal } from '@/lib/types';
import { getConfig } from '@/actions/config';
import { getOperatorState } from '@/actions/asterisk';
import { findContactByPhone } from '@/actions/crm';
import { CallerInfoCard } from '@/components/operator/caller-info-card';
import { AlertTriangle, Loader2, User as UserIcon, Phone, Clock, MessageSquare, PhoneOff, UserX } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FollowUpList } from '@/components/operator/follow-up-list';
import { DateRangePicker } from '@/components/shared/date-range-picker';
import { useSearchParams } from 'next/navigation';
import { getCallHistory, getCallById, type DateRangeParams } from '@/actions/cdr';
import { subDays, format, parseISO, isValid } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { CallDetailsDialog } from '@/components/operator/call-details-dialog';
import { useToast } from '@/hooks/use-toast';
import { getUsers } from '@/actions/users';
import { Separator } from '@/components/ui/separator';

function OperatorStatusCard({ user, status }: { user: User; status: CallState['status'] | 'wrap-up' }) {
    const statusConfig = {
      offline: { text: 'Оффлайн', color: 'bg-gray-500', icon: PhoneOff },
      available: { text: 'Доступен', color: 'bg-green-500', icon: Phone },
      ringing: { text: 'Входящий звонок', color: 'bg-yellow-500 animate-pulse', icon: Phone },
      'on-call': { text: 'В разговоре', color: 'bg-red-500', icon: Phone },
      busy: { text: 'В разговоре', color: 'bg-red-500', icon: Phone },
      'in use': { text: 'В разговоре', color: 'bg-red-500', icon: Phone },
      dnd: { text: 'Не беспокоить', color: 'bg-orange-500', icon: UserX },
      connecting: { text: 'Соединение...', color: 'bg-blue-500', icon: Loader2 },
      'wrap-up': { text: 'Пост-обработка', color: 'bg-indigo-500', icon: Clock },
    };
  
    const currentStatus = statusConfig[status] || statusConfig.offline;
    const Icon = currentStatus.icon;
  
    return (
      <Card>
        <CardHeader>
           <CardTitle>Статус</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Оператор</p>
              <p className="font-semibold">{user.name} (доб. {user.extension})</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Текущий статус</p>
              <div className="flex items-center gap-2 pt-1">
                 <div className={cn('h-3 w-3 rounded-full', currentStatus.color)} />
                 <span className="font-semibold">{currentStatus.text}</span>
              </div>
            </div>
        </CardContent>
      </Card>
    );
}

function KpiCard({ title, value, icon: Icon }: { title: string, value: string, icon: React.ElementType }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
}

function KpiSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-8 w-16" />
            </CardContent>
        </Card>
    );
}

function MyKpiComponent({ user }: { user: User }) {
    const searchParams = useSearchParams();
    const [calls, setCalls] = useState<Call[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCalls = async () => {
            if (!user.extension) {
                setError('У пользователя нет внутреннего номера.');
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                const toParam = searchParams.get('to');
                const fromParam = searchParams.get('from');

                const to = toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : new Date();
                const from = fromParam && isValid(parseISO(fromParam)) ? parseISO(fromParam) : subDays(to, 6);
                const dateRange: DateRangeParams = { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };

                const config = await getConfig();
                const result = await getCallHistory(config.cdr, dateRange);
                if (result.success && result.data) {
                    const filteredCalls = result.data.filter(call => call.operatorExtension === user.extension);
                    setCalls(filteredCalls);
                } else {
                    setError(result.error || 'Не удалось загрузить историю звонков.');
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Произошла неизвестная ошибка.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchCalls();
    }, [user, searchParams]);

    const kpiData = useMemo(() => {
        const formatTime = (seconds: number) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            let result = '';
            if (hours > 0) result += `${hours}ч `;
            if (minutes > 0 || hours > 0) result += `${minutes}м `;
            result += `${secs}с`;
            return result.trim();
        };

        const answeredCalls = calls.filter(c => c.status === 'ANSWERED' && c.billsec !== undefined);
        const totalAnswered = answeredCalls.length;
        const totalTalkTime = answeredCalls.reduce((acc, c) => acc + (c.billsec || 0), 0);
        const avgHandleTime = totalAnswered > 0 ? totalTalkTime / totalAnswered : 0;

        return {
            totalAnswered: totalAnswered.toString(),
            totalTalkTime: formatTime(totalTalkTime),
            avgHandleTime: formatTime(avgHandleTime),
        };
    }, [calls]);

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Мои показатели эффективности</CardTitle>
                        <CardDescription>Ваши KPI за выбранный период.</CardDescription>
                    </div>
                    <DateRangePicker />
                </div>
            </CardHeader>
            <CardContent>
                 {isLoading ? (
                     <div className="grid gap-4 md:grid-cols-3">
                        <KpiSkeleton />
                        <KpiSkeleton />
                        <KpiSkeleton />
                    </div>
                ) : error ? (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Ошибка загрузки KPI</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                        <KpiCard title="Всего отвечено" value={kpiData.totalAnswered} icon={Phone} />
                        <KpiCard title="Общее время разговора" value={kpiData.totalTalkTime} icon={MessageSquare} />
                        <KpiCard title="Среднее время обработки" value={kpiData.avgHandleTime} icon={Clock} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


export default function OperatorPage() {
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [callState, setCallState] = useState<CallState>({ status: 'offline', endpointState: 'offline' });
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
    
    const [selectedCall, setSelectedCall] = useState<Call | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const { toast } = useToast();
    
    const previousStatusRef = useRef<string | null>(null);

    useEffect(() => {
        const initialize = async () => {
            try {
                const storedUser = localStorage.getItem('loggedInUser');
                if (storedUser) {
                    const parsedUser: User = JSON.parse(storedUser);
                    setUser(parsedUser);
                } else {
                     setError('Пользователь не авторизован.');
                }
                
                const appConfig = await getConfig();
                setConfig(appConfig);

            } catch (e) {
                const message = e instanceof Error ? e.message : 'An unknown error occurred';
                setError(message)
            } finally {
                setIsLoading(false);
            }
        };
        initialize();
    }, []);

    useEffect(() => {
        if (!user?.extension || !config?.ari) return;

        const poll = async () => {
            const result = await getOperatorState(config.ari, user.extension!);
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
                const newState: CallState = { ...prevState, status: newStatus, endpointState: newStatus, ...newCallStateData };
                if (JSON.stringify(prevState) !== JSON.stringify(newState)) {
                    return newState;
                }
                return prevState;
            });
        };

        poll();
        const intervalId = setInterval(poll, 5000);
        return () => clearInterval(intervalId);
    }, [user, config]);

    useEffect(() => {
        if (!config?.ari) return;

        const currentStatus = callState.status;
        const prevStatus = previousStatusRef.current;
        
        if ((currentStatus === 'ringing' || currentStatus === 'on-call') && callState.uniqueId && callState.callerId) {
            setIsWrapUp(false);
            if (!isModalOpen) setIsModalOpen(true);
            
            if (activeCallData?.uniqueId !== callState.uniqueId) {
                 setActiveCallData({
                     uniqueId: callState.uniqueId,
                     channelId: callState.channelId!,
                     callerNumber: callState.callerId,
                     queue: callState.queue,
                 });
                 findContactByPhone(callState.callerId).then(({ contact, history }) => {
                    setCrmContact(contact);
                    setCallHistory(history);
                });
            }
        } 
        else if ((prevStatus === 'on-call' || prevStatus === 'ringing') && currentStatus !== 'on-call' && currentStatus !== 'ringing' && activeCallData) {
            setIsWrapUp(true);
        } 
        else if (!isWrapUp) {
            if (isModalOpen) handleCloseModal();
        }

        previousStatusRef.current = currentStatus;
    }, [callState, isModalOpen, isWrapUp, activeCallData, config]);


    const handleCloseModal = () => {
        setIsWrapUp(false);
        setIsModalOpen(false);
        setActiveCallData(null);
        setCrmContact(null);
        setCallHistory([]);
    };

    const handleContactUpdate = (updatedContact: CrmContact) => {
        setCrmContact(updatedContact);
    }

    const handleFollowUpClick = async (appeal: Appeal) => {
        if (!config) return;
        const callResult = await getCallById(config.cdr, appeal.callId);
        
        if (callResult.success && callResult.data) {
            const users = await getUsers();
            const userMap = new Map(users.filter(u => u.extension).map(user => [user.extension, user.name]));
            const enrichedCall = {
                ...callResult.data,
                operatorName: callResult.data.operatorExtension
                    ? (userMap.get(callResult.data.operatorExtension) || `Ext. ${callResult.data.operatorExtension}`)
                    : 'N/A',
            };

            setSelectedCall(enrichedCall);
            setIsDetailsOpen(true);
        } else {
            toast({
                variant: 'destructive',
                title: 'Ошибка',
                description: 'Не удалось загрузить детали звонка для этого обращения.',
            });
        }
    };
    
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="container mx-auto max-w-lg mt-10">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Ошибка доступа</AlertTitle>
                    <AlertDescription>
                        {error || 'Не удалось загрузить данные пользователя.'}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (user.role !== 'operator' || !user.extension) {
        return (
            <div className="container mx-auto max-w-lg mt-10">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Доступ запрещен или неверная конфигурация</AlertTitle>
                    <AlertDescription>
                        Эта страница доступна только для операторов с назначенным внутренним номером.
                    </AlertDescription>
                </Alert>
            </div>
        );
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
             <CallDetailsDialog
                isOpen={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                call={selectedCall}
                isCrmEditable={false}
            />
            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-grow space-y-6">
                    <MyKpiComponent user={user} />
                    <Suspense fallback={<Card><CardHeader><CardTitle>Задачи на перезвон</CardTitle><CardDescription>Список клиентов, с которыми нужно связаться.</CardDescription></CardHeader><CardContent className="flex justify-center items-center h-72"><Loader2 className="animate-spin" /></CardContent></Card>}>
                        <FollowUpList operatorId={user.id} onItemClick={handleFollowUpClick} />
                    </Suspense>
                </div>
                <div className="lg:w-80 xl:w-96 flex-shrink-0">
                     <OperatorStatusCard user={user} status={isWrapUp ? 'wrap-up' : callState.status} />
                </div>
            </div>
        </>
    );
}

    