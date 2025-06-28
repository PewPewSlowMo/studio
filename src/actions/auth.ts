'use server';

import { z } from 'zod';
import { getUsers } from './users';
import type { User } from '@/lib/types';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

type LoginCredentials = z.infer<typeof LoginSchema>;

export async function loginUser(
  credentials: LoginCredentials
): Promise<{ success: boolean; user?: Omit<User, 'password'>; error?: string }> {
  try {
    const validatedCredentials = LoginSchema.parse(credentials);
    const users = await getUsers();

    const user = users.find(
      (u) => u.email.toLowerCase() === validatedCredentials.email.toLowerCase()
    );

    if (!user) {
      return { success: false, error: 'Пользователь с таким email не найден.' };
    }

    // IMPORTANT: In a production environment, passwords should be hashed and salted.
    // This is a plain text comparison for prototype purposes only.
    if (user.password !== validatedCredentials.password) {
      return { success: false, error: 'Неверный пароль.' };
    }
    
    if (!user.isActive) {
        return { success: false, error: 'Ваша учетная запись деактивирована.' };
    }

    const { password, ...userWithoutPassword } = user;

    return { success: true, user: userWithoutPassword };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Произошла неизвестная ошибка.';
    console.error('loginUser failed:', message);
    return { success: false, error: message };
  }
}
