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
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
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
          message: 'Extension is required for operators.',
          path: ['extension'],
        }
      )
      .superRefine((data, ctx) => {
        if (!isEditing && (!data.password || data.password.length < 6)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Password is required and must be at least 6 characters.',
            path: ['password'],
          });
        }
        if (data.password && data.password.length > 0 && data.password.length < 6) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Password must be at least 6 characters.',
                path: ['password'],
            });
        }
        if (data.password !== data.confirmPassword) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Passwords don't match",
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
          <DialogTitle>{user ? 'Edit User' : 'Create New User'}</DialogTitle>
          <DialogDescription>
            {user
              ? "Update the user's details. Leave password blank to keep it unchanged."
              : 'Fill in the details for the new user.'}
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
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
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
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="operator">Operator</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
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
                    <FormLabel>Asterisk Extension</FormLabel>
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
                          <SelectValue placeholder="Select an extension" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingEndpoints ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />{' '}
                            Loading...
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={isEditing ? 'Leave blank to keep current' : '••••••••'}
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
                  <FormLabel>Confirm Password</FormLabel>
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
                Cancel
              </Button>
              <Button type="submit">Save User</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
