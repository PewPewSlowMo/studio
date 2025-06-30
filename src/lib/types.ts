export type UserRole = 'admin' | 'manager' | 'supervisor' | 'operator';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  groupId?: string;
  isActive: boolean;
  createdAt: string;
  extension?: string;
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

export interface CallState {
  status: 'offline' | 'available' | 'ringing' | 'on-call' | 'connecting';
  channelId?: string;
  channelName?: string;
  callerId?: string;
  queue?: string;
  uniqueId?: string;
}

export interface CrmContact {
  phoneNumber: string;
  name: string;
  address: string;
  type: string;
  email?: string;
}

export interface Appeal {
  id: string;
  callId: string;
  operatorId: string;
  operatorName: string;
  callerNumber: string;
  description: string;
  resolution: string;
  createdAt: string;
  // New fields
  category: 'sales' | 'complaint' | 'support' | 'info' | 'other';
  priority: 'low' | 'medium' | 'high';
  satisfaction: 'satisfied' | 'neutral' | 'dissatisfied' | 'n/a';
  notes: string;
  followUp: boolean;
}
