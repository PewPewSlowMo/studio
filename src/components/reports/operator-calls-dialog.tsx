'use client';
import { useState, useEffect } from 'react';
import type { Call, User } from '@/lib/types';
import { getCallHistory, type GetCallHistoryParams } from '@/actions/cdr';
import { getConfig } from '@/actions/config';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { CallHistoryTable } from './call-history-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { CallDetailsDialog } from '../operator/call-details-dialog';
import { getUsers } from '@/actions/users';

interface OperatorCallsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  operator: User | null;
  dateRange: { from: string; to: string };
}

export function OperatorCallsDialog({ isOpen, onOpenChange, operator, dateRange }: OperatorCallsDialogProps) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  useEffect(() => {
    if (isOpen && operator?.extension) {
      const fetchCalls = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const config = await getConfig();
          const params: GetCallHistoryParams = {
            ...dateRange,
            operatorExtension: operator.extension!,
          };
          const callsResult = await getCallHistory(config.cdr, params);
          if (callsResult.success && callsResult.data) {
              const users = await getUsers();
              const userMap = new Map(users.map(u => [u.extension, u.name]));
              
              const answeredCalls = callsResult.data
                  .filter(c => c.status === 'ANSWERED')
                  .map(c => ({...c, operatorName: userMap.get(c.operatorExtension!)}));

              setCalls(answeredCalls);
          } else {
            setError(callsResult.error || 'Failed to fetch calls for this operator.');
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchCalls();
    }
  }, [isOpen, operator, dateRange]);

  const handleRowClick = (call: Call) => {
    setSelectedCall(call);
    setIsDetailsOpen(true);
  };

  return (
    <>
      <CallDetailsDialog
        isOpen={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        call={selectedCall}
        user={operator}
        isCrmEditable={false}
      />
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Принятые звонки: {operator?.name}</DialogTitle>
            <DialogDescription>
              Список звонков, отвеченных оператором за выбранный период.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {error ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Ошибка загрузки</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <CallHistoryTable calls={calls} isLoading={isLoading} onRowClick={handleRowClick} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
