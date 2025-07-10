'use server';

import { z } from 'zod';
import type { User } from '@/lib/types';
import { getDbConnection } from './app-db';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

type LoginCredentials = z.infer<typeof LoginSchema>;

export async function loginUser(
  credentials: LoginCredentials
): Promise<{ success: boolean; user?: Omit<User, 'password'>; error?: string }> {
  const db = await getDbConnection();
  try {
    const validatedCredentials = LoginSchema.parse(credentials);
    
    const user = await db.get<User>(
      'SELECT * FROM users WHERE email = ?',
      validatedCredentials.email.toLowerCase()
    );

    if (!user) {
      return { success: false, error: 'Пользователь с таким email не найден.' };
    }

    if (user.password !== validatedCredentials.password) {
      return { success: false, error: 'Неверный пароль.' };
    }
    
    if (!user.isActive) {
        return { success: false, error: 'Ваша учетная запись деактивирована.' };
    }

    const { password, ...userWithoutPassword } = user;

    return { success: true, user: { ...userWithoutPassword, isActive: Boolean(user.isActive) } };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Произошла неизвестная ошибка.';
    console.error('loginUser failed:', message);
    return { success: false, error: message };
  } finally {
      if (db) {
          await db.close();
      }
  }
}
