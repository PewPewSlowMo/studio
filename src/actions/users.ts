'use server';

import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import type { User } from '@/lib/types';
import type { UserFormData } from '@/components/admin/user-form-dialog';
import { getDbConnection } from './app-db';

export async function getUsers(): Promise<User[]> {
  const db = await getDbConnection();
  try {
    const users = await db.all<User[]>('SELECT * FROM users ORDER BY createdAt DESC');
    return users.map(user => ({
        ...user,
        // Convert integer 0/1 from DB back to boolean
        isActive: Boolean(user.isActive),
    }));
  } finally {
    await db.close();
  }
}

export async function addUser(userData: UserFormData): Promise<User> {
  const db = await getDbConnection();
  try {
    const { confirmPassword, ...restUserData } = userData;

    const newUser: User = {
      id: crypto.randomUUID(),
      ...restUserData,
      username: userData.email.split('@')[0],
      isActive: true,
      createdAt: new Date().toISOString(),
      extension: userData.extension || '',
      password: userData.password!, // Password is required for new users by the form validation
    };

    await db.run(
      'INSERT INTO users (id, name, email, role, extension, password, username, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      newUser.id,
      newUser.name,
      newUser.email,
      newUser.role,
      newUser.extension,
      newUser.password,
      newUser.username,
      newUser.isActive,
      newUser.createdAt
    );

    revalidatePath('/admin');
    return newUser;
  } finally {
    await db.close();
  }
}

export async function updateUser(id: string, userData: UserFormData): Promise<void> {
    const db = await getDbConnection();
    try {
        const { password, confirmPassword, ...restUserData } = userData;
        
        if (password) {
            // If password is provided, update it along with other fields
             await db.run(
                `UPDATE users SET name = ?, email = ?, role = ?, extension = ?, password = ? WHERE id = ?`,
                restUserData.name,
                restUserData.email,
                restUserData.role,
                restUserData.extension || '',
                password,
                id
            );
        } else {
            // If password is not provided, update only other fields
            await db.run(
                `UPDATE users SET name = ?, email = ?, role = ?, extension = ? WHERE id = ?`,
                restUserData.name,
                restUserData.email,
                restUserData.role,
                restUserData.extension || '',
                id
            );
        }

        revalidatePath('/admin');
    } finally {
        await db.close();
    }
}

export async function toggleUserStatus(id: string, currentStatus: boolean): Promise<void> {
    const db = await getDbConnection();
    try {
        await db.run('UPDATE users SET isActive = ? WHERE id = ?', !currentStatus, id);
        revalidatePath('/admin');
    } finally {
        await db.close();
    }
}

export async function deleteUser(id: string): Promise<void> {
    const db = await getDbConnection();
    try {
        const result = await db.run('DELETE FROM users WHERE id = ?', id);
        if (result.changes === 0) {
            throw new Error('User not found to delete.');
        }
        revalidatePath('/admin');
    } finally {
        await db.close();
    }
}
