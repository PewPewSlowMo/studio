'use server';

import type { CallState } from '@/lib/types';
import { getAmiEndpoint, getChannelInfo } from './ami';
import { getConfig } from './config';

const mapDeviceState = (state: string): CallState['status'] => {
    state = state.toLowerCase();
    switch (state) {
        case 'not in use': return 'available';
        case 'in use': return 'on-call';
        case 'busy': return 'on-call';
        case 'ringing': return 'ringing';
        case 'ring,in use': return 'ringing'; // Sometimes Asterisk combines states
        case 'on hold': return 'on-call';
        case 'dnd': return 'dnd';
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
        
        // 1. Get the primary device state for the endpoint
        const endpointResult = await getAmiEndpoint(config.ami, extension);
        
        if (!endpointResult.success || !endpointResult.data) {
            return { success: false, error: endpointResult.error || `Could not get endpoint ${extension}.` };
        }

        const endpoint = endpointResult.data;
        const mappedStatus = mapDeviceState(endpoint.state);

        let finalCallState: CallState = {
            status: mappedStatus,
            endpointState: mappedStatus,
            extension: extension,
        };

        // 2. If the endpoint is on a call, get channel details
        const activeChannelId = endpoint.channel_ids?.[0];
        if (activeChannelId && (mappedStatus === 'on-call' || mappedStatus === 'ringing')) {
            const channelInfoResult = await getChannelInfo(config.ami, activeChannelId);

            if (channelInfoResult.success && channelInfoResult.data) {
                const channelData = channelInfoResult.data;
                finalCallState = {
                    ...finalCallState,
                    channelId: activeChannelId,
                    uniqueId: channelData.uniqueid,
                    linkedId: channelData.linkedid,
                    callerId: channelData.connectedlinenum || channelData.calleridnum, // Prefer connected line number
                    queue: channelData.context,
                };
            }
        }
        
        return { success: true, data: finalCallState };

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred in getOperatorState';
        console.error('getOperatorState failed for extension', extension, ':', message);
        return { success: false, error: message };
    }
}
