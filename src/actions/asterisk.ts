
'use server';

import type { CallState } from '@/lib/types';
import { getAriChannelDetails, getAriEndpointDetails } from './ari';
import { getAmiEndpoint } from './ami';
import { getConfig } from './config';

/**
 * Maps Asterisk device states to simplified CallState statuses.
 */
const mapDeviceState = (state: string): CallState['status'] => {
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
 * Retrieves the real-time state of an operator, including their status and active call details.
 * This function uses a hybrid AMI/ARI approach for best results.
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
        if (!config.ami || !config.ari) {
            return { success: false, error: 'AMI or ARI configuration is missing.' };
        }
        
        // --- Step 1: Get endpoint status from AMI for reliability ---
        const amiResult = await getAmiEndpoint(config.ami, extension);

        if (!amiResult.success || !amiResult.data) {
             return { success: true, data: { status: 'offline', endpointState: 'offline' } };
        }
        
        const amiEndpoint = amiResult.data;
        const baseStatus = mapDeviceState(amiEndpoint.devicestate);
        
        let finalCallState: CallState = {
            status: baseStatus,
            endpointState: baseStatus,
            extension: extension,
        };

        // --- Step 2: If on a call, enrich with details from ARI ---
        const activeCallStatuses = ['on-call', 'ringing'];
        
        if (activeCallStatuses.includes(baseStatus)) {
            // ARI is better for getting detailed call info like caller ID
            try {
                const ariEndpoint = await getAriEndpointDetails(config.ari, extension);
                const channelId = ariEndpoint?.channel_ids?.[0];

                if (channelId) {
                    const channelDetails = await getAriChannelDetails(config.ari, channelId);
                    
                    if (channelDetails) {
                        finalCallState = {
                            ...finalCallState,
                            channelId: channelId,
                            uniqueId: channelDetails.uniqueid_from_vars,
                            callerId: channelDetails.connected_line_num || 'Unknown',
                            queue: channelDetails.dialplan?.context,
                        };
                    }
                }
            } catch (ariError) {
                // This can happen if the call ends between the AMI and ARI checks.
                // It's not a critical failure; we just won't have call details.
                // The base status from AMI is still valid.
                console.warn(`[getOperatorState] ARI enrichment failed for ext ${extension}, but AMI status is likely correct. Error:`, ariError instanceof Error ? ariError.message : ariError);
            }
        }
        
        return { success: true, data: finalCallState };

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred in getOperatorState';
        console.error('getOperatorState failed for extension', extension, ':', message);
        return { success: false, error: message };
    }
}
