'use client';

import { useEffect, useRef } from 'react';
import { useForm, useFormContext } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { saveAppeal, type AppealFormData } from '@/actions/appeals';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { Loader2, Save, Timer } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

const WRAP_UP_SECONDS = 60;

export const appealFormSchema = z.object({
  description: z.string().min(1, 'Описание обязательно для заполнения.'),
  resolution: z.string().optional(),
  category: z.enum(['sales', 'complaint', 'support', 'info', 'other'], { required_error: 'Выберите категорию.' }),
  priority: z.enum(['low', 'medium', 'high']),
  satisfaction: z.enum(['satisfied', 'neutral', 'dissatisfied', 'n/a']),
  notes: z.string().optional(),
  followUp: z.boolean().default(false),
});

export type AppealFormValues = z.infer<typeof appealFormSchema>;

interface AppealFormProps {
  form: any; // Pass form instance from parent
  callId: string;
  callerNumber: string;
  operator: User;
  isWrapUp: boolean;
  onFormSubmit: () => void;
}

export function AppealForm({ form, callId, callerNumber, operator, isWrapUp, onFormSubmit }: AppealFormProps) {
  const { toast } = useToast();
  
  const { isSubmitting } = form.formState;

  async function onSubmit(values: AppealFormValues) {
    const appealData: AppealFormData = {
      ...values,
      callId,
      callerNumber,
      operatorId: operator.id,
      operatorName: operator.name,
    };
    
    const result = await saveAppeal(appealData);

    if (result.success) {
      onFormSubmit();
    } else {
      toast({
        variant: 'destructive',
        title: 'Ошибка сохранения',
        description: result.error || 'Не удалось сохранить обращение.',
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Описание звонка *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Опишите суть обращения клиента..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Категория</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Выберите..." />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="info">Информация</SelectItem>
                      <SelectItem value="sales">Продажи</SelectItem>
                      <SelectItem value="support">Техподдержка</SelectItem>
                      <SelectItem value="complaint">Жалоба</SelectItem>
                      <SelectItem value="other">Другое</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
             <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Приоритет</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Выберите..." />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Низкий</SelectItem>
                      <SelectItem value="medium">Средний</SelectItem>
                      <SelectItem value="high">Высокий</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <FormField
          control={form.control}
          name="resolution"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Решение/Результат</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Какое решение было предложено или предпринято..."
                  className="min-h-[60px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
            control={form.control}
            name="satisfaction"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Удовлетворенность клиента</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Оцените..." />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="satisfied">Доволен</SelectItem>
                      <SelectItem value="neutral">Нейтрально</SelectItem>
                      <SelectItem value="dissatisfied">Недоволен</SelectItem>
                      <SelectItem value="n/a">Неприменимо</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Дополнительные заметки</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Любые дополнительные заметки о звонке..."
                  className="min-h-[60px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
            control={form.control}
            name="followUp"
            render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                <FormControl>
                    <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    />
                </FormControl>
                <div className="space-y-1 leading-none">
                    <FormLabel>
                    Требуется последующий контакт
                    </FormLabel>
                </div>
                </FormItem>
            )}
         />
        <Separator />
         <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Save className="mr-2 h-4 w-4" />
                )}
                {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </Button>
         </div>
      </form>
    </Form>
  );
}
