
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Loader2, Save } from 'lucide-react';
import { addOrUpdateContact } from '@/actions/crm';
import { useToast } from '@/hooks/use-toast';
import type { CrmContact } from '@/lib/types';
import { Separator } from '@/components/ui/separator';

export const crmContactFormSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать не менее 2 символов.'),
  address: z.string().min(5, 'Адрес должен содержать не менее 5 символов.'),
  type: z.enum(['контингент', 'фсмс', 'платный', 'иной']),
  email: z.string().email({ message: 'Неверный формат email' }).optional().or(z.literal('')),
});

export type CrmContactFormValues = z.infer<typeof crmContactFormSchema>;

interface CrmContactFormProps {
  form: any;
  phoneNumber: string;
  onSave: (contact: CrmContact) => void;
}

const contactTypes = ['контингент', 'фсмс', 'платный', 'иной'];

export function CrmContactForm({ form, phoneNumber, onSave }: CrmContactFormProps) {
  const { toast } = useToast();
  const { isSubmitting } = form.formState;

  async function onSubmit(data: CrmContactFormValues) {
    const contactData = { ...data, phoneNumber };
    const result = await addOrUpdateContact(contactData);
    if (result.success) {
      toast({
        title: 'Контакт сохранен',
        description: `Данные для номера ${phoneNumber} были успешно обновлены.`,
      });
      onSave?.(contactData);
    } else {
      toast({
        variant: 'destructive',
        title: 'Ошибка сохранения',
        description: result.error || 'Не удалось сохранить контакт.',
      });
    }
  }

  return (
    <div className="p-3 border border-dashed rounded-lg">
      <p className="text-sm font-medium mb-2">Новый контакт</p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Ф.И.О.</FormLabel>
                <FormControl>
                  <Input placeholder="Иванов Иван..." {...field} />
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
                <FormLabel className="text-xs">Email</FormLabel>
                <FormControl>
                  <Input placeholder="user@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Адрес</FormLabel>
                <FormControl>
                  <Input placeholder="г. Алматы..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Статус клиента</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {contactTypes.map(type => (
                       <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Button size="sm" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Сохранить
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
