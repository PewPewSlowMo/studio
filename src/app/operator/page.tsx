'use client';

import { useState, useEffect } from 'react';
import { OperatorWorkspace } from '@/components/operator/operator-workspace';
import { getConfig, type AppConfig } from '@/actions/config';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { User } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MyCallsTab } from '@/components/operator/my-calls-tab';
import { MyKpiTab } from '@/components/operator/my-kpi-tab';
import { CrmTab } from '@/components/operator/crm-tab';


export default function OperatorPage() {
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initialize = async () => {
            try {
                const storedUser = localStorage.getItem('loggedInUser');
                if (storedUser) {
                    const parsedUser: User = JSON.parse(storedUser);
                    if (parsedUser.role === 'operator') {
                        setUser(parsedUser);
                    } else {
                         setError('Вы не авторизованы как оператор.');
                    }
                } else {
                    setError('Пользователь не авторизован.');
                }
                
                const appConfig = await getConfig();
                setConfig(appConfig);

            } catch (e) {
                const message = e instanceof Error ? e.message : 'An unknown error occurred';
                console.error("Failed to initialize operator page", message);
                setError(message)
            } finally {
                setIsLoading(false);
            }
        };
        initialize();
    }, []);

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

    if (user.role === 'operator' && !user.extension) {
        return (
            <div className="container mx-auto max-w-lg mt-10">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Отсутствует внутренний номер</AlertTitle>
                    <AlertDescription>
                        Вашей учетной записи не назначен внутренний номер (extension). Пожалуйста, обратитесь к администратору для его назначения.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    if (!config) {
         return (
            <div className="container mx-auto max-w-lg mt-10">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Ошибка конфигурации</AlertTitle>
                    <AlertDescription>
                        Не удалось загрузить конфигурацию приложения.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <Tabs defaultValue="workspace" className="w-full">
            <TabsList className="grid w-full grid-cols-4 max-w-xl mx-auto">
                <TabsTrigger value="workspace">Рабочее место</TabsTrigger>
                <TabsTrigger value="calls">Мои звонки</TabsTrigger>
                <TabsTrigger value="kpi">Мои KPI</TabsTrigger>
                <TabsTrigger value="crm">Поиск в CRM</TabsTrigger>
            </TabsList>
            <TabsContent value="workspace" className="mt-6">
                <OperatorWorkspace user={user} amiConnection={config.ami} ariConnection={config.ari} />
            </TabsContent>
            <TabsContent value="calls" className="mt-6">
                <MyCallsTab user={user} />
            </TabsContent>
            <TabsContent value="kpi" className="mt-6">
                <MyKpiTab user={user} />
            </TabsContent>
            <TabsContent value="crm" className="mt-6">
                <CrmTab />
            </TabsContent>
        </Tabs>
    );
}
