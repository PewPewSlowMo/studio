'use server';
import * as xlsx from 'xlsx';
import { getCallHistory, type DateRangeParams } from './cdr';
import { getUsers } from './users';
import { getConfig } from './config';
import { getAppeals } from './appeals';
import type { User, Appeal, Call } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

// Helper function for flexible ID matching
const findAppealByFlexibleId = (appeals: Appeal[], callId: string): Appeal | undefined => {
    let appeal = appeals.find(a => a.callId === callId);
    if (appeal) return appeal;

    if (callId.includes('.')) {
        const callIdBase = callId.substring(0, callId.lastIndexOf('.'));
        appeal = appeals.find(a => a.callId.startsWith(callIdBase));
        if (appeal) return appeal;
    }
    
    return undefined;
};

const formatDuration = (seconds: number | undefined) => {
    if (seconds === undefined || seconds === null || isNaN(seconds)) return '00:00:00';
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
        const date = parseISO(dateString);
        return format(date, 'dd.MM.yyyy HH:mm:ss', { locale: ru });
    } catch {
        return '';
    }
};

export async function exportOperatorReport(dateRange: DateRangeParams): Promise<{ success: boolean; data?: string; error?: string; }> {
    try {
        const config = await getConfig();
        const [callsResult, users, appeals] = await Promise.all([
            getCallHistory(config.cdr, dateRange),
            getUsers(),
            getAppeals(),
        ]);
        
        if (!callsResult.success || !callsResult.data) {
            throw new Error(callsResult.error || 'Failed to fetch call history');
        }

        const calls = callsResult.data;
        const operators = users.filter(u => u.role === 'operator' && u.extension);
        const userMap = new Map(users.map(u => [u.extension, u.name]));

        const reportData = operators.map(operator => {
            const operatorCalls = calls.filter(c => c.operatorExtension === operator.extension);
            const answeredCalls = operatorCalls.filter(c => c.status === 'ANSWERED');
            const totalTalkTime = answeredCalls.reduce((acc, c) => acc + (c.billsec || 0), 0);
            
            return {
                'Оператор': operator.name,
                'Внутренний номер': operator.extension,
                'Всего звонков': operatorCalls.length,
                'Принято': answeredCalls.length,
                'Пропущено': operatorCalls.length - answeredCalls.length,
                'Общее время разговора': formatDuration(totalTalkTime),
                'Среднее время разговора': formatDuration(answeredCalls.length > 0 ? totalTalkTime / answeredCalls.length : 0),
            };
        });
        
        const detailedCallsData = calls.map(call => {
            const appeal = findAppealByFlexibleId(appeals, call.id);
            return {
                'ID Звонка': call.id,
                'Время начала': formatDate(call.startTime),
                'Номер звонящего': call.callerNumber,
                'Номер назначения': call.calledNumber,
                'Оператор': userMap.get(call.operatorExtension!) || call.operatorExtension || 'N/A',
                'Статус': call.status,
                'Очередь': call.queue || 'N/A',
                'Время разговора (сек)': call.billsec || 0,
                'Общая длительность (сек)': call.duration || 0,
                'Категория обращения': appeal?.category || '',
                'Результат обращения': appeal?.resolution || '',
                'Описание': appeal?.description || '',
                'Заметки': appeal?.notes || '',
            };
        });

        const wb = xlsx.utils.book_new();
        const wsSummary = xlsx.utils.json_to_sheet(reportData);
        const wsDetailed = xlsx.utils.json_to_sheet(detailedCallsData);

        xlsx.utils.book_append_sheet(wb, wsSummary, 'Сводный отчет по операторам');
        xlsx.utils.book_append_sheet(wb, wsDetailed, 'Детализация по звонкам');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const base64Data = buffer.toString('base64');

        return { success: true, data: base64Data };
    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred';
        console.error('Failed to export report:', message);
        return { success: false, error: message };
    }
}
