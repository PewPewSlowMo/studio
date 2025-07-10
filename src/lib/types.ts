export type UserRole = 'admin' | 'manager' | 'supervisor' | 'operator';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  groupId?: string;
  isActive: boolean;
  createdAt: Date; // Changed to Date for SQL
  extension?: string | null; // Allow null for non-operators
  password?: string;
}

export type OperatorStatus = 'online' | 'busy' | 'offline';

export interface Operator {
  id: string;
  userId: string;
  name: string;
  extension: string;
  status: OperatorStatus;
  currentCalls: number;
  lastActivity: string;
}

export interface Call {
  id: string;
  linkedId?: string;
  callerNumber: string;
  calledNumber: string;
  operatorId?: string;
  operatorName?: string;
  operatorExtension?: string;
  queue?: string;
  status: string; // From 'ANSWERED', 'NO ANSWER', 'BUSY' etc.
  startTime: string;
  answerTime?: string;
  endTime?: string;
  duration?: number; // Total call duration
  billsec?: number; // Talk time
  waitTime?: number;
  recordingUrl?: string;
  reason?: string;
  isOutgoing?: boolean;
  satisfaction?: string;
  // Add new fields for enriched data
  callerName?: string;
  appealDescription?: string;
}

export interface AsteriskEndpoint {
  technology: string;
  resource: string;
  state: string;
  channel_ids: string[];
}

export interface AsteriskQueue {
  name: string;
}

export interface QueueReportData {
  queueName: string;
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  abandonmentRate: number;
  sla: number;
  avgWaitTime: number; // In seconds
  avgHandleTime: number; // In seconds
}

export interface OperatorReportData {
    operatorId: string;
    operatorName: string;
    firstCallTime: string | null;
    lastCallTime: string | null;
    answeredIncomingCount: number;
    outgoingCount: number;
    missedCallsPercentage: number;
    avgTalkTime: number;
    avgWaitTime: number;
    satisfactionScore: string;
    transferredToSupervisorCount: number;
}


export interface CallState {
  status: 'offline' | 'available' | 'ringing' | 'on-call' | 'connecting' | 'busy' | 'in use' | 'away' | 'dnd' | 'unavailable';
  endpointState: 'offline' | 'available' | 'ringing' | 'on-call' | 'connecting' | 'busy' | 'in use' | 'away' | 'dnd' | 'unavailable';
  channelId?: string;
  channelName?: string;
  callerId?: string;
  queue?: string;
  uniqueId?: string;
  linkedId?: string;
  extension?: string;
}

export interface CrmContact {
  phoneNumber: string;
  name: string;
  address: string;
  type: string;
  email?: string;
  notes?: string;
}

export interface Appeal {
  id: string;
  callId: string;
  operatorId: string;
  operatorName: string;
  callerNumber: string;
  description: string;
  resolution: 'переведен старшему оператору' | 'услуга оказана полностью' | 'услуга оказана частично' | 'отказано в услуге';
  createdAt: string;
  category: 'Жалобы' | 'Прикрепление' | 'Запись на прием' | 'Информация' | 'Госпитализация' | 'Анализы' | 'Иные';
  priority: 'low' | 'medium' | 'high';
  satisfaction: 'yes' | 'no';
  notes: string;
  followUp: boolean;
  followUpCompleted?: boolean;
}
