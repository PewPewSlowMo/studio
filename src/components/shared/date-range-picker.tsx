'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { format, subDays, parseISO, isValid } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon } from 'lucide-react';
import { ru } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function DateRangePicker({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getInitialDateRange = (): DateRange => {
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    
    let fromDate, toDate;

    if (fromParam && isValid(parseISO(fromParam))) {
        fromDate = parseISO(fromParam);
    } else {
        fromDate = subDays(new Date(), 6); // Default to last 7 days
    }
    
    if (toParam && isValid(parseISO(toParam))) {
        toDate = parseISO(toParam);
    } else {
        toDate = new Date(); // Default to today
    }
    
    return { from: fromDate, to: toDate };
  };

  const [date, setDate] = React.useState<DateRange | undefined>(getInitialDateRange());
  const [isOpen, setIsOpen] = React.useState(false);

  const updateUrlParams = (newDate: DateRange | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newDate?.from) {
      params.set('from', format(newDate.from, 'yyyy-MM-dd'));
    } else {
      params.delete('from');
    }
    if (newDate?.to) {
      params.set('to', format(newDate.to, 'yyyy-MM-dd'));
    } else {
      params.delete('to');
    }
    // Using replace to avoid polluting browser history on every date change
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  
  const handleDateSelect = (newDate: DateRange | undefined) => {
    setDate(newDate);
    if(newDate?.from && newDate?.to) {
        updateUrlParams(newDate);
        setIsOpen(false);
    }
  }

  const handlePresetSelect = (value: string) => {
    const now = new Date();
    let fromDate: Date;
    let toDate: Date = now;

    switch (value) {
        case 'today':
            fromDate = new Date(now);
            break;
        case 'yesterday':
            fromDate = subDays(now, 1);
            toDate = subDays(now, 1);
            break;
        case 'last_7_days':
            fromDate = subDays(now, 6);
            break;
        case 'last_30_days':
            fromDate = subDays(now, 29);
            break;
        default:
            return;
    }
    const newRange = { from: fromDate, to: toDate };
    setDate(newRange);
    updateUrlParams(newRange);
    setIsOpen(false);
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-full justify-start text-left font-normal md:w-[300px]',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'd MMM, y', { locale: ru })} -{' '}
                  {format(date.to, 'd MMM, y', { locale: ru })}
                </>
              ) : (
                format(date.from, 'd MMM, y', { locale: ru })
              )
            ) : (
              <span>Выберите дату</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex items-center justify-start border-b p-2">
            <Select onValueChange={handlePresetSelect}>
                <SelectTrigger className="w-[180px] focus:ring-0">
                    <SelectValue placeholder="Быстрый выбор" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="today">Сегодня</SelectItem>
                    <SelectItem value="yesterday">Вчера</SelectItem>
                    <SelectItem value="last_7_days">Последние 7 дней</SelectItem>
                    <SelectItem value="last_30_days">Последние 30 дней</SelectItem>
                </SelectContent>
            </Select>
          </div>
           <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            locale={ru}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
