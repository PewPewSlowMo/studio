import type { Operator, Call } from './types';

export const mockOperators: Operator[] = [
  { id: 'op-1', userId: 'user-4', name: 'Mike Ross', extension: '1001', status: 'online', currentCalls: 0, lastActivity: new Date().toISOString() },
  { id: 'op-2', userId: 'user-5', name: 'Sara Connor', extension: '1002', status: 'offline', currentCalls: 0, lastActivity: '2023-10-26T18:00:00Z' },
  { id: 'op-3', userId: 'user-6', name: 'Peter Jones', extension: '1003', status: 'busy', currentCalls: 1, lastActivity: new Date().toISOString() },
  { id: 'op-4', userId: 'user-7', name: 'Laura Wilson', extension: '1004', status: 'online', currentCalls: 0, lastActivity: new Date().toISOString() },
];

export const mockCalls: Call[] = [
  { id: 'call-1', channelId: 'ch-1', callerNumber: '+1-202-555-0104', calledNumber: '800-123-4567', operatorId: 'op-1', operatorName: 'Mike Ross', queueId: 'q-1', status: 'completed', startTime: '2023-10-27T09:01:00Z', answerTime: '2023-10-27T09:01:15Z', endTime: '2023-10-27T09:05:30Z', duration: 255 },
  { id: 'call-2', channelId: 'ch-2', callerNumber: '+1-202-555-0182', calledNumber: '800-123-4567', operatorId: 'op-3', operatorName: 'Peter Jones', queueId: 'q-2', status: 'answered', startTime: '2023-10-27T09:02:30Z', answerTime: '2023-10-27T09:02:40Z' },
  { id: 'call-3', channelId: 'ch-3', callerNumber: '+1-202-555-0156', calledNumber: '800-123-4567', queueId: 'q-1', status: 'missed', startTime: '2023-10-27T09:03:00Z' },
  { id: 'call-4', channelId: 'ch-4', callerNumber: '+1-202-555-0199', calledNumber: '800-123-4567', operatorId: 'op-4', operatorName: 'Laura Wilson', queueId: 'q-1', status: 'completed', startTime: '2023-10-27T08:55:00Z', answerTime: '2023-10-27T08:55:20Z', endTime: '2023-10-27T08:59:10Z', duration: 230 },
  { id: 'call-5', channelId: 'ch-5', callerNumber: '+1-202-555-0123', calledNumber: '800-123-4567', queueId: 'q-1', status: 'incoming', startTime: '2023-10-27T09:04:10Z' },
];

export const mockCallVolume = [
  { hour: '09:00', calls: 23 }, { hour: '10:00', calls: 31 }, { hour: '11:00', calls: 45 }, { hour: '12:00', calls: 40 },
  { hour: '13:00', calls: 55 }, { hour: '14:00', calls: 62 }, { hour: '15:00', calls: 58 }, { hour: '16:00', calls: 49 },
  { hour: '17:00', calls: 35 },
];
