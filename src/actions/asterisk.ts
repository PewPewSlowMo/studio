'use server';

import type { CallState } from '@/lib/types';
import { getAmiEndpoint } from './ami';
import { getConfig } from './config';

const mapDeviceState = (state: string): CallState['status'] => {
    state = state.toLowerCase().trim();
    switch (state) {
        case 'not in use': return 'available';
        case 'in use': return 'on-call';
        case 'busy': return 'on-call';
        case 'ringing': return 'ringing';
        case 'ring,in use': return 'ringing';
        case 'on hold': return 'on-call';
        case 'dnd': return 'dnd';
        case 'away': return 'away';
        case 'unavailable': return 'unavailable';
        case 'invalid': return 'offline';
        default: return 'offline';
    }
};

export async function getOperatorState(
    extension: string
): Promise<{
    success: boolean;
    data?: CallState;
    error?: string;
}> {
    try {
        const config = await getConfig();
        if (!config || !config.ami) {
            return { success: false, error: 'AMI configuration is missing.' };
        }
        
        const endpointResult = await getAmiEndpoint(config.ami, extension);
        
        if (!endpointResult.success || !endpointResult.data) {
            return { success: false, error: endpointResult.error || `Could not get endpoint ${extension}.` };
        }

        const endpointData = endpointResult.data;
        const mappedStatus = mapDeviceState(endpointData.devicestate);

        let finalCallState: CallState = {
            status: mappedStatus,
            endpointState: mappedStatus,
            extension: extension,
        };

        const activeChannelId = endpointData.channel;
        if (activeChannelId && (mappedStatus === 'on-call' || mappedStatus === 'ringing')) {
             finalCallState = {
                ...finalCallState,
                channelId: activeChannelId,
                uniqueId: endpointData.uniqueid, // This might not be present, depends on context
                callerId: endpointData.connectedlinenum || endpointData.callerid,
                queue: endpointData.context,
            };
        }
        
        return { success: true, data: finalCallState };

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred in getOperatorState';
        console.error('getOperatorState failed for extension', extension, ':', message);
        return { success: false, error: message };
    }
}
