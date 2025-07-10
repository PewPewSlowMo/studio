'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { User, AsteriskEndpoint } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const baseUserFormSchema = z.object({
  name: z.string().min(1, 'Имя обязательно'),
  email: z.string().email('Неверный формат email'),
  role: z.enum(['admin', 'manager', 'supervisor', 'operator']),
  extension: z.string().optional(),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
});

export type UserFormData = z.infer<typeof baseUserFormSchema>;

interface UserFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user?: User | null;
  endpoints: AsteriskEndpoint[];
  onSave: (data: UserFormData) => void;
  isLoadingEndpoints: boolean;
}

export function UserFormDialog({
  isOpen,
  onOpenChange,
  user,
  endpoints,
  onSave,
  isLoadingEndpoints,
}: UserFormDialogProps) {
  const isEditing = !!user;

  const userFormSchema = useMemo(() => baseUserFormSchema
      .refine(
        (data) => {
          if (data.role === 'operator' && !data.extension) {
            return false;
          }
          return true;
        },
        {
          message: 'Внутренний номер обязателен для оператора.',
          path: ['extension'],
        }
      )
      .superRefine((data, ctx) => {
        if (!isEditing && (!data.password || data.password.length < 6)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Пароль обязателен и должен содержать не менее 6 символов.',
            path: ['password'],
          });
        }
        if (data.password && data.password.length > 0 && data.password.length < 6) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Пароль должен содержать не менее 6 символов.',
                path: ['password'],
            });
        }
        if (data.password !== data.confirmPassword) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Пароли не совпадают",
            path: ['confirmPassword'],
          });
        }
      }), [isEditing]);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'operator',
      extension: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (user) {
        form.reset({
          name: user.name,
          email: user.email,
          role: user.role,
          extension: user.extension || '',
          password: '',
          confirmPassword: '',
        });
      } else {
        form.reset({
          name: '',
          email: '',
          role: 'operator',
          extension: '',
          password: '',
          confirmPassword: '',
        });
      }
      form.clearErrors();
    }
  }, [isOpen, user, form]);

  function onSubmit(data: UserFormData) {
    onSave(data);
    onOpenChange(false);
  }

  const role = form.watch('role');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{user ? 'Редактировать пользователя' : 'Создать нового пользователя'}</DialogTitle>
          <DialogDescription>
            {user
              ? "Обновите данные пользователя. Оставьте поле пароля пустым, чтобы не менять его."
              : 'Заполните данные для нового пользователя.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Имя</FormLabel>
                  <FormControl>
                    <Input placeholder="Иван Иванов" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="user@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Роль</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите роль" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="operator">Оператор</SelectItem>
                      <SelectItem value="supervisor">Супервизор</SelectItem>
                      <SelectItem value="manager">Менеджер</SelectItem>
                      <SelectItem value="admin">Администратор</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {role === 'operator' && (
              <FormField
                control={form.control}
                name="extension"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Внутренний номер Asterisk</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                      disabled={isLoadingEndpoints}
                    >
                      <FormControl>
                        <SelectTrigger>
                          {isLoadingEndpoints && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          <SelectValue placeholder="Выберите номер" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingEndpoints ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />{' '}
                            Загрузка...
                          </div>
                        ) : (
                          <>
                            {endpoints.map((endpoint) => (
                              <SelectItem
                                key={endpoint.resource}
                                value={endpoint.resource}
                              >
                                {endpoint.resource} ({endpoint.state})
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Пароль</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={isEditing ? 'Оставьте пустым, чтобы не менять' : '••••••••'}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Подтвердите пароль</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      {...field} 
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Отмена
              </Button>
              <Button type="submit">Сохранить</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
