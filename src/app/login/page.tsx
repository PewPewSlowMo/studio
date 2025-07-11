'use client';

import { LoginForm } from '@/components/auth/login-form';
import { BarChart } from 'lucide-react';
import { useEffect } from 'react';
import { initializeDatabase } from '@/actions/app-db';

export default function LoginPage() {

  useEffect(() => {
    // This ensures the database and tables are created on the very first run.
    initializeDatabase();
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 p-3 text-white shadow-lg">
            <BarChart className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            CallSync Central
          </h1>
          <p className="text-muted-foreground">
            Войдите в систему аналитики колл-центра
          </p>
        </div>
        <LoginForm />
      </div>
      <footer className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>© 2025 CallSync Central. Разработано для Национального Госпиталя.</p>
      </footer>
    </div>
  );
}