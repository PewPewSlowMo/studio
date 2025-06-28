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
  queueId?: string;
  status: string; // From 'ANSWERED', 'NO ANSWER', 'BUSY' etc.
  startTime: string;
  answerTime?: string;
  endTime?: string;
  duration?: number;
  recordingUrl?: string;
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
