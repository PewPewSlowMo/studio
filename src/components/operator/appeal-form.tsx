'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

const WRAP_UP_SECONDS = 60;

const formSchema = z.object({
  appealType: z.enum(['complaint', 'service', 'other'], { required_error: 'Please select a type.' }),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  resolution: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AppealFormProps {
  callId: string;
  callerNumber: string;
  operator: User;
  isWrapUp: boolean;
  onWrapUpEnd: () => void;
}

export function AppealForm({ callId, callerNumber, operator, isWrapUp, onWrapUpEnd }: AppealFormProps) {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(WRAP_UP_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      appealType: undefined,
      description: '',
      resolution: '',
    },
  });

  const { isSubmitting, getValues } = form;

  const handleAutoSubmit = async () => {
      const values = getValues();
      if (!values.appealType || !values.description) {
           toast({
              title: 'Автосохранение отменено',
              description: 'Недостаточно данных для сохранения обращения.',
              variant: 'destructive'
            });
           onWrapUpEnd();
           return;
      }

      const appealData: AppealFormData = {
        ...values,
        callId,
        callerNumber,
        operatorId: operator.id,
        operatorName: operator.name,
      };
      
      const result = await saveAppeal(appealData);

      if (result.success) {
        toast({
          title: 'Обращение автосохранено',
          description: 'Карточка обращения была сохранена автоматически.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка автосохранения',
          description: result.error || 'Не удалось автоматически сохранить обращение.',
        });
      }
      onWrapUpEnd();
  };

  useEffect(() => {
    if (isWrapUp) {
      setTimeLeft(WRAP_UP_SECONDS);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
        if(timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
        if(timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWrapUp]);


  async function onSubmit(values: FormValues) {
    const appealData: AppealFormData = {
      ...values,
      callId,
      callerNumber,
      operatorId: operator.id,
      operatorName: operator.name,
    };
    
    const result = await saveAppeal(appealData);

    if (result.success) {
      toast({
        title: 'Обращение сохранено',
        description: 'Карточка обращения успешно создана.',
      });
      form.reset();
      if(isWrapUp) {
          onWrapUpEnd();
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Ошибка сохранения',
        description: result.error || 'Не удалось сохранить обращение.',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Карточка обращения</CardTitle>
        <CardDescription>Заполните информацию по текущему или последнему звонку.</CardDescription>
        {isWrapUp && (
          <div className="pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
               <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  <span>Время на заполнение</span>
               </div>
               <span className="font-mono font-semibold">{timeLeft}с</span>
            </div>
            <Progress value={(timeLeft / WRAP_UP_SECONDS) * 100} className="h-2" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="appealType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип обращения</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите тип..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="complaint">Жалоба</SelectItem>
                      <SelectItem value="service">Заявка на услугу</SelectItem>
                      <SelectItem value="other">Иное обращение</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Детально опишите суть обращения клиента..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="resolution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Решение / Результат</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Опишите результат разговора или принятые меры..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Сохранение...' : 'Сохранить обращение'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
