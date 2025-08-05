'use server';

import type { CallState } from '@/lib/types';
import { getAmiEndpoint } from './ami';
import { getAriChannelDetails, getAriEndpointDetails } from './ari';
import { getConfig } from './config';

/**
 * Maps Asterisk device states from AMI to simplified CallState statuses.
 */
const mapAmiDeviceState = (state: string): CallState['status'] => {
    state = state?.toLowerCase().trim() || 'unavailable';
    switch (state) {
        case 'not in use': return 'available';
        case 'in use': return 'on-call';
        case 'busy': return 'on-call';
        case 'ringing': return 'ringing';
        case 'ring,in use': return 'ringing';
        case 'on hold': return 'on-call';
        case 'unavailable': return 'unavailable';
        case 'invalid': return 'offline';
        default: return 'offline';
    }
};

/**
 * Maps Asterisk channel states from ARI to simplified CallState statuses.
 */
const mapAriChannelState = (state: string): CallState['status'] => {
    state = state?.toLowerCase().trim();
    switch (state) {
        case 'ring': return 'ringing';
        case 'ringing': return 'ringing';
        case 'up': return 'on-call';
        default: return 'available'; // Default to available if channel exists but isn't in a clear "busy" state
    }
};

/**
 * Retrieves the real-time state of an operator, including their status and active call details.
 * This function implements a robust, multi-layered approach to determine the caller's number,
 * prioritizing ARI for details and falling back to AMI for basic status.
 */
export async function getOperatorState(
    extension: string
): Promise<{
    success: boolean;
    data?: CallState;
    error?: string;
}> {
    try {
        const config = await getConfig();
        if (!config.ari || !config.ami) {
            return { success: false, error: 'ARI or AMI configuration is missing.' };
        }
        
        // --- Step 1: Get base endpoint status from AMI ---
        // This is a fast and reliable way to get the basic device state.
        const amiResult = await getAmiEndpoint(config.ami, extension);
        if (!amiResult.success || !amiResult.data) {
            return { success: false, error: amiResult.error || `Could not get AMI endpoint ${extension}.` };
        }
        const amiEndpoint = amiResult.data;
        const baseStatus = mapAmiDeviceState(amiEndpoint.devicestate);

        let finalCallState: CallState = {
            status: baseStatus,
            endpointState: baseStatus,
            extension: extension,
        };
        
        // --- Step 2: If AMI shows activity, use ARI to get rich details ---
        // ARI is more reliable for getting specific call details like caller ID and channel info.
        if (baseStatus === 'on-call' || baseStatus === 'ringing') {
            const ariEndpoint = await getAriEndpointDetails(config.ari, extension);
            const channelId = ariEndpoint?.channel_ids?.[0];
            
            if (channelId) {
                const channelDetails = await getAriChannelDetails(config.ari, channelId);
                if (channelDetails) {
                    const connectedLineNum = channelDetails.connected?.number || channelDetails.caller?.number;
                    const uniqueId = channelDetails.dialplan?.exten; // Often contains the uniqueid

                    finalCallState = {
                        ...finalCallState,
                        status: mapAriChannelState(channelDetails.state), // Refine status based on ARI channel state
                        channelId: channelId,
                        uniqueId: uniqueId || channelDetails.id, // Fallback to channel ID if uniqueid not in dialplan
                        callerId: connectedLineNum || 'Unknown',
                        queue: channelDetails.dialplan?.context,
                    };
                }
            } else {
                 // Fallback to AMI data if ARI channel details are not available
                 const connectedLineNum = amiEndpoint.connectedlinenum || amiEndpoint.callerid;
                 finalCallState = {
                    ...finalCallState,
                    callerId: connectedLineNum || 'Unknown',
                    uniqueId: amiEndpoint.uniqueid,
                    queue: amiEndpoint.context,
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
