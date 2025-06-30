'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  summarizeCall,
  type SummarizeCallOutput,
} from '@/ai/flows/call-summarization';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Tags, ThumbsUp, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const formSchema = z.object({
  audioFile: z
    .any()
    .refine((files) => files?.length > 0, 'Аудиофайл обязателен.'),
  transcript: z.string().min(10, 'Транскрипт должен содержать не менее 10 символов.'),
});

export default function SummarizationPage() {
  const [result, setResult] = useState<SummarizeCallOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { transcript: '' },
  });

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setResult(null);

    try {
      const audioFile = values.audioFile[0];
      const recordingDataUri = await fileToBase64(audioFile);

      const aiResult = await summarizeCall({
        recordingDataUri,
        transcript: values.transcript,
      });
      setResult(aiResult);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Произошла ошибка',
        description:
          error instanceof Error
            ? error.message
            : 'Не удалось обработать звонок.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Интеллектуальный анализ звонков</CardTitle>
          <CardDescription>
            Загрузите запись звонка и транскрипт, чтобы получить анализ на базе ИИ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="audioFile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Запись звонка</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => field.onChange(e.target.files)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="transcript"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Транскрипт</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Вставьте сюда транскрипт звонка..."
                        className="min-h-[200px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Анализировать звонок
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="space-y-8">
        {isLoading && (
          <Card className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p>Анализ звонка...</p>
              <p className="text-sm">Это может занять некоторое время.</p>
            </div>
          </Card>
        )}
        {result && (
          <>
            <Card>
              <CardHeader className="flex-row items-center gap-4 space-y-0">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>Резюме</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{result.summary}</p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-8">
              <Card>
                <CardHeader className="flex-row items-center gap-4 space-y-0">
                  <Tags className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle>Категории</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {result.categories.map((cat, i) => (
                    <Badge key={i} variant="secondary">
                      {cat}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex-row items-center gap-4 space-y-0">
                  <ThumbsUp className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle>Тональность</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <Badge className="text-lg" variant="outline">
                    {result.sentiment}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
