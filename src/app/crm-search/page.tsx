'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, UserSearch } from 'lucide-react';
import { findContactByPhone } from '@/actions/crm';
import type { CrmContact } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { CrmEditor } from '@/components/operator/crm-editor';

export default function CrmSearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<{ contact: CrmContact | null, phoneNumber: string } | null>(null);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsLoading(true);
    setSearchResult(null);

    try {
      const { contact } = await findContactByPhone(searchQuery);
      setSearchResult({ contact, phoneNumber: searchQuery });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      toast({
        variant: 'destructive',
        title: 'Ошибка поиска',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSave = (contact: CrmContact) => {
    setSearchResult({ contact, phoneNumber: contact.phoneNumber });
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Поиск по базе CRM</CardTitle>
        <CardDescription>
          Найдите или создайте нового клиента по номеру телефона.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="tel"
            placeholder="Введите номер телефона..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !searchQuery}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Найти
          </Button>
        </form>

        {isLoading && (
            <div className="text-center p-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                <p>Идет поиск...</p>
            </div>
        )}
        
        {searchResult ? (
          <CrmEditor
            contact={searchResult.contact}
            phoneNumber={searchResult.phoneNumber}
            onSave={handleSave}
          />
        ) : !isLoading && (
            <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <UserSearch className="h-12 w-12 mx-auto mb-2" />
                <p>Результаты поиска появятся здесь.</p>
            </div>
        )}

      </CardContent>
    </Card>
  );
}
