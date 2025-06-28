'use client';

import { useState, useEffect } from 'react';
import { OperatorWorkspace } from '@/components/operator/operator-workspace';
import { getConfig, type AppConfig } from '@/actions/config';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { User } from '@/lib/types';

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
                    if (parsedUser.role === 'operator' && parsedUser.extension) {
                        setUser(parsedUser);
                    } else {
                         setError('Вы не авторизованы как оператор или у вашей учетной записи не задан внутренний номер.');
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

    return <OperatorWorkspace user={user} amiConnection={config.ami} ariConnection={config.ari} />;
}
