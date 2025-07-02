'use client';
import { useEffect, useState, useTransition, useCallback } from 'react';
import type { Appeal } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toggleFollowUpStatus, getFollowUpAppeals } from '@/actions/appeals';
import { useToast } from '@/hooks/use-toast';
import { MessageCircleWarning, Loader2 } from 'lucide-react';

type AppealWithCaller = Appeal & { callerName?: string };

interface FollowUpListProps {
    operatorId: string;
    onItemClick: (appeal: AppealWithCaller) => void;
}

export function FollowUpList({ operatorId, onItemClick }: FollowUpListProps) {
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
                <CardContent className="h-[500px] flex items-center justify-center">
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
                <ScrollArea className="h-[500px]">
                    {appeals.length > 0 ? (
                        <div className="space-y-3">
                            {appeals.map((appeal) => (
                                <div
                                    key={appeal.id}
                                    className="flex items-center gap-4 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => onItemClick(appeal)}
                                >
                                    <Checkbox
                                        id={`follow-up-${appeal.id}`}
                                        checked={!!appeal.followUpCompleted}
                                        onCheckedChange={() => handleToggle(appeal.id)}
                                        aria-label="Mark as completed"
                                        disabled={isPending}
                                        onClick={(e) => e.stopPropagation()} // Prevent triggering the main onClick
                                    />
                                    <div className="flex-1 grid gap-1">
                                        <div className="flex items-baseline justify-between">
                                            <p className="font-semibold text-primary truncate">
                                                {appeal.callerName || appeal.callerNumber}
                                            </p>
                                            <p className="text-xs text-muted-foreground font-mono">
                                                {appeal.callerNumber}
                                            </p>
                                        </div>
                                        <p className="text-sm text-muted-foreground truncate">
                                            {appeal.description || 'Нет описания'}
                                        </p>
                                    </div>
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
