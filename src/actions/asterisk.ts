'use server';

import { z } from 'zod';
import type { CallState, AppConfig } from '@/lib/types';
import { getExtensionState, getChannelInfo } from './ami';
import { getConfig } from './config';


const mapAmiStatus = (status: string, statusText: string): CallState['status'] => {
    switch (status) {
        case '-1': return 'offline'; // Not found
        case '0':  // Idle
            if (statusText.toLowerCase() === 'dnd') return 'dnd';
            if (statusText.toLowerCase() === 'away') return 'away';
            return 'available';
        case '1': return 'on-call'; // In Use
        case '2': return 'on-call'; // Busy
        case '4': return 'unavailable'; // Unavailable
        case '8': return 'ringing'; // Ringing
        case '16': return 'on-call'; // On Hold
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
        
        const extStateResult = await getExtensionState(config.ami, extension);

        if (!extStateResult.success || !extStateResult.data) {
            return { success: false, error: extStateResult.error || `Could not get state for extension ${extension}.` };
        }

        const { status, statustext, channel, channeltype, calleridnum, uniqueid, linkedid } = extStateResult.data;
        const mappedStatus = mapAmiStatus(status, statustext.toLowerCase());

        let finalCallState: CallState = {
            status: mappedStatus,
            endpointState: mappedStatus,
            extension: extension,
        };

        // If there's an active channel, enrich with call details
        if (channel && channeltype) {
            finalCallState.channelId = channel;
            finalCallState.uniqueId = uniqueid;
            finalCallState.callerId = calleridnum;
            finalCallState.linkedId = linkedid;
        }

        return { success: true, data: finalCallState };

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred in getOperatorState';
        console.error('getOperatorState failed:', message);
        return { success: false, error: message };
    }
}
