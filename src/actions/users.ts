'use server';

import { revalidatePath } from 'next/cache';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { User } from '@/lib/types';
import type { UserFormData } from '@/components/admin/user-form-dialog';

const USERS_DB_PATH = path.join(process.cwd(), 'data', 'users.json');

async function readUsers(): Promise<User[]> {
  try {
    // Ensure the directory exists before reading
    await fs.mkdir(path.dirname(USERS_DB_PATH), { recursive: true });
    const data = await fs.readFile(USERS_DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // If the file doesn't exist, it's the first run.
      // Create it with an empty array.
      await writeUsers([]);
      return [];
    }
    console.error('Error reading users database:', error);
    throw new Error('Could not read from the database.');
  }
}

async function writeUsers(users: User[]): Promise<void> {
  try {
    await fs.writeFile(USERS_DB_PATH, JSON.stringify(users, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to users database:', error);
    throw new Error('Could not write to the database.');
  }
}

export async function getUsers(): Promise<User[]> {
  const users = await readUsers();
  // Sort by createdAt date descending
  return users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function addUser(userData: UserFormData): Promise<User> {
  const users = await readUsers();
  const { confirmPassword, ...restUserData } = userData;

  const newUser: User = {
    id: crypto.randomUUID(),
    ...restUserData,
    username: userData.email.split('@')[0],
    isActive: true,
    createdAt: new Date().toISOString(),
    extension: userData.extension || '',
  };

  users.push(newUser);
  await writeUsers(users);

  revalidatePath('/admin');
  return newUser;
}

export async function updateUser(id: string, userData: UserFormData): Promise<void> {
  const users = await readUsers();
  const userIndex = users.findIndex((user) => user.id === id);

  if (userIndex === -1) {
    throw new Error('User not found.');
  }
  
  const { password, confirmPassword, ...restUserData } = userData;

  const updatedUser: User = {
    ...users[userIndex],
    ...restUserData,
    extension: userData.extension || '',
  };

  if (password) {
    updatedUser.password = password;
  }

  users[userIndex] = updatedUser;

  await writeUsers(users);
  revalidatePath('/admin');
}

export async function toggleUserStatus(id: string, currentStatus: boolean): Promise<void> {
  const users = await readUsers();
  const userIndex = users.findIndex((user) => user.id === id);

  if (userIndex === -1) {
    throw new Error('User not found.');
  }

  users[userIndex].isActive = !currentStatus;
  await writeUsers(users);
  revalidatePath('/admin');
}

export async function deleteUser(id: string): Promise<void> {
  let users = await readUsers();
  const originalLength = users.length;
  const updatedUsers = users.filter((user) => user.id !== id);

  if (originalLength === updatedUsers.length) {
    // This can happen in a race condition, but for this app it's a good guard.
    throw new Error('User not found to delete.');
  }

  await writeUsers(updatedUsers);
  revalidatePath('/admin');
}
