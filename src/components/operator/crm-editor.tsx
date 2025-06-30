'use client';

import { useEffect } from 'react';
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

const crmFormSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать не менее 2 символов.'),
  address: z.string().min(5, 'Адрес должен содержать не менее 5 символов.'),
  type: z.enum(['контингент', 'фсмс', 'платный', 'иной']),
  phoneNumber: z.string(),
  email: z.string().email('Неверный формат email').optional().or(z.literal('')),
});

type CrmFormData = z.infer<typeof crmFormSchema>;

interface CrmEditorProps {
  contact: CrmContact | null;
  phoneNumber: string;
  onSave?: (contact: CrmContact) => void;
}

const contactTypes = ['контингент', 'фсмс', 'платный', 'иной'];

export function CrmEditor({ contact, phoneNumber, onSave }: CrmEditorProps) {
  const { toast } = useToast();
  const form = useForm<CrmFormData>({
    resolver: zodResolver(crmFormSchema),
    defaultValues: {
      name: '',
      address: '',
      type: 'иной',
      phoneNumber: phoneNumber,
      email: '',
    },
  });

  const { isSubmitting } = form.formState;

  useEffect(() => {
    if (contact) {
      form.reset({
        name: contact.name,
        address: contact.address,
        // @ts-ignore
        type: contactTypes.includes(contact.type) ? contact.type : 'иной',
        phoneNumber: contact.phoneNumber,
        email: contact.email || '',
      });
    } else {
      form.reset({
        name: '',
        address: '',
        type: 'иной',
        phoneNumber: phoneNumber,
        email: '',
      });
    }
  }, [contact, phoneNumber, form]);

  async function onSubmit(data: CrmFormData) {
    const result = await addOrUpdateContact(data);
    if (result.success) {
      toast({
        title: 'Контакт сохранен',
        description: `Данные для номера ${data.phoneNumber} были успешно обновлены.`,
      });
      onSave?.(data);
    } else {
      toast({
        variant: 'destructive',
        title: 'Ошибка сохранения',
        description: result.error || 'Не удалось сохранить контакт.',
      });
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Данные клиента</h3>
      <Separator />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
             <div className="space-y-2">
                <FormLabel>Номер телефона</FormLabel>
                <Input value={phoneNumber} disabled />
             </div>
             <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Статус клиента</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите тип..." />
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
          </div>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ф.И.О.</FormLabel>
                <FormControl>
                  <Input placeholder="Иванов Иван Иванович" {...field} />
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
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Адрес</FormLabel>
                <FormControl>
                  <Input placeholder="г. Алматы, ул. Абая, 1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {contact ? 'Обновить данные' : 'Сохранить контакт'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
