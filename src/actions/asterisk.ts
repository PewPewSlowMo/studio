
'use server';

import type { CallState } from '@/lib/types';
import { getAriChannelDetails, getAriEndpointDetails } from './ari';
import { getConfig } from './config';

/**
 * Maps Asterisk device states to simplified CallState statuses.
 */
const mapAriDeviceState = (state: string): CallState['status'] => {
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
 * Maps Asterisk channel states to simplified CallState statuses.
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
 * This function uses ARI exclusively for a more reliable and consistent state representation.
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
        if (!config.ari) {
            return { success: false, error: 'ARI configuration is missing.' };
        }
        
        // --- Step 1: Get endpoint details from ARI ---
        const ariEndpoint = await getAriEndpointDetails(config.ari, extension);
        
        if (!ariEndpoint) {
            return { success: true, data: { status: 'offline', endpointState: 'offline' } };
        }
        
        const baseStatus = mapAriDeviceState(ariEndpoint.state);
        let finalCallState: CallState = {
            status: baseStatus,
            endpointState: baseStatus,
            extension: extension,
        };

        // --- Step 2: If endpoint is in use, get detailed channel info ---
        const channelId = ariEndpoint.channel_ids?.[0];

        if (channelId) {
            // This function can return null if the channel was hung up during polling.
            const channelDetails = await getAriChannelDetails(config.ari, channelId);

            // Only update with channel data if details were successfully fetched.
            // If channelDetails is null, it means the call just ended, and we should
            // stick with the base endpoint status.
            if (channelDetails) {
                // Prioritize the uniqueid from channel variables if available
                const uniqueId = channelDetails.uniqueid_from_vars;
                // Prioritize the connected line number from channel variables
                const callerId = channelDetails.connected_line_num;

                finalCallState = {
                    ...finalCallState,
                    status: mapAriChannelState(channelDetails.state), // Refine status based on ARI channel state
                    channelId: channelId,
                    uniqueId: uniqueId,
                    callerId: callerId || 'Unknown',
                    queue: channelDetails.dialplan?.context,
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
