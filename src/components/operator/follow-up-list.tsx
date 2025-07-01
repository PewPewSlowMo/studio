'use client';
import { useEffect, useState, useTransition, useCallback } from 'react';
import type { Appeal } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toggleFollowUpStatus, getFollowUpAppeals } from '@/actions/appeals';
import { useToast } from '@/hooks/use-toast';
import { PhoneOutgoing, MessageCircleWarning, Loader2 } from 'lucide-react';

type AppealWithCaller = Appeal & { callerName?: string };

interface FollowUpListProps {
    operatorId: string;
}

export function FollowUpList({ operatorId }: FollowUpListProps) {
    const [appeals, setAppeals] = useState<AppealWithCaller[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const fetchAppeals = useCallback(async () => {
        try {
            const data = await getFollowUpAppeals(operatorId);
            setAppeals(data);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Ошибка',
                description: 'Не удалось загрузить задачи на перезвон.',
            });
        }
    }, [operatorId, toast]);

    useEffect(() => {
        setIsLoading(true);
        fetchAppeals().finally(() => setIsLoading(false));
    }, [fetchAppeals]);

    const handleToggle = (appealId: string) => {
        startTransition(async () => {
            const result = await toggleFollowUpStatus(appealId);
            if (result.success) {
                toast({ title: 'Статус обновлен', description: 'Задача на перезвон обновлена.' });
                await fetchAppeals();
            } else {
                toast({ variant: 'destructive', title: 'Ошибка', description: result.error });
            }
        });
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Задачи на перезвон</CardTitle>
                    <CardDescription>Список клиентов, с которыми нужно связаться.</CardDescription>
                </CardHeader>
                <CardContent className="h-[calc(100vh-22rem)] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Задачи на перезвон</CardTitle>
                <CardDescription>Список клиентов, с которыми нужно связаться.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[calc(100vh-22rem)]">
                    {appeals.length > 0 ? (
                        <div className="space-y-4">
                            {appeals.map((appeal) => (
                                <div key={appeal.id} className="flex items-center">
                                    <Checkbox
                                        id={`follow-up-${appeal.id}`}
                                        checked={!!appeal.followUpCompleted}
                                        onCheckedChange={() => handleToggle(appeal.id)}
                                        aria-label="Mark as completed"
                                        disabled={isPending}
                                    />
                                    <div className="ml-4 grid gap-1.5 leading-none">
                                        <label
                                            htmlFor={`follow-up-${appeal.id}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            {appeal.callerName || appeal.callerNumber}
                                        </label>
                                        <p className="text-sm text-muted-foreground truncate">
                                            {appeal.description}
                                        </p>
                                    </div>
                                    <button className="ml-auto p-1 text-muted-foreground hover:text-foreground">
                                        <PhoneOutgoing className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground pt-10">
                            <MessageCircleWarning className="h-10 w-10 mb-2" />
                            <p className="font-semibold">Нет задач</p>
                            <p className="text-sm text-center">Задачи на перезвон появятся здесь.</p>
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
