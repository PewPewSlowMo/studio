// src/app/api/recordings/[...path]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/actions/config';
import { getCallById } from '@/actions/cdr';
import SftpClient from 'ssh2-sftp-client';
import { writeToLog } from '@/actions/logger';

const LOG_COMPONENT = 'RECORDING_API';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const uniqueid = params.path[0];
  await writeToLog(LOG_COMPONENT, `--- New recording request received ---`);
  await writeToLog(LOG_COMPONENT, `Step 1: Received request for uniqueid: ${uniqueid}`);

  if (!uniqueid) {
    const errorMsg = 'Call UniqueID is required';
    await writeToLog(LOG_COMPONENT, { level: 'ERROR', message: errorMsg });
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  try {
    const config = await getConfig();
    await writeToLog(LOG_COMPONENT, 'Step 2: Successfully loaded system configuration.');

    // 1. Fetch the call details from CDR DB to get the recordingfile
    await writeToLog(LOG_COMPONENT, `Step 3: Fetching call details from CDR for uniqueid: ${uniqueid}`);
    const callResult = await getCallById(config.cdr, uniqueid);
    
    if (!callResult.success || !callResult.data) {
      const errorMsg = `Call not found in CDR database for uniqueid: ${uniqueid}`;
      await writeToLog(LOG_COMPONENT, { level: 'ERROR', message: errorMsg, callResult });
      return NextResponse.json({ error: 'Call not found in CDR' }, { status: 404 });
    }
    
    const { recordingfile } = callResult.data;
    await writeToLog(LOG_COMPONENT, {
        message: 'Step 4: Found call in CDR.',
        uniqueid: callResult.data.id,
        recordingfile: recordingfile,
    });


    if (!recordingfile) {
      const errorMsg = 'No recording file associated with this call in CDR.';
      await writeToLog(LOG_COMPONENT, { level: 'ERROR', message: errorMsg });
      return NextResponse.json({ error: errorMsg }, { status: 404 });
    }

    // 2. Construct the full path on the remote server
    const datePartMatch = recordingfile.match(/(\d{4})(\d{2})(\d{2})-\d{6}/);

    if (!datePartMatch) {
       const errorMsg = `Could not determine date part from filename: ${recordingfile}`;
       await writeToLog(LOG_COMPONENT, { level: 'ERROR', message: errorMsg });
       throw new Error(errorMsg);
    }
    
    const [, fyear, fmonth, fday] = datePartMatch;
    
    const monitor_base = `/var/spool/asterisk/monitor`; 
    const remotePath = `${monitor_base}/${fyear}/${fmonth}/${fday}/${recordingfile}`;
    await writeToLog(LOG_COMPONENT, `Step 5: Constructed remote file path: ${remotePath}`);

    // 3. Connect via SFTP and download the file
    const sftp = new SftpClient();
    const sftpConfig = {
      host: config.ami.host,
      port: 22, // Standard SSH port
      username: config.ami.username,
      password: config.ami.password,
    };

    await writeToLog(LOG_COMPONENT, {
        message: 'Step 6: Attempting to connect to SFTP server.',
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        // IMPORTANT: Never log the password
    });

    await sftp.connect(sftpConfig);
    await writeToLog(LOG_COMPONENT, 'Step 7: SFTP connection successful.');

    // 4. Get the file as a buffer
    await writeToLog(LOG_COMPONENT, `Step 8: Attempting to download file from: ${remotePath}`);
    const audioBuffer = await sftp.get(remotePath);
    await sftp.end();
    await writeToLog(LOG_COMPONENT, `Step 9: File downloaded successfully. Buffer size: ${audioBuffer.length} bytes.`);

    if (!(audioBuffer instanceof Buffer)) {
        const errorMsg = 'Failed to download file, received unexpected type.';
        await writeToLog(LOG_COMPONENT, { level: 'ERROR', message: errorMsg });
        throw new Error(errorMsg);
    }

    // 5. Stream the file back to the client
    const headers = new Headers();
    const contentType = recordingfile.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', audioBuffer.length.toString());
    
    await writeToLog(LOG_COMPONENT, 'Step 10: Sending audio buffer to client.');
    await writeToLog(LOG_COMPONENT, `--- Request for ${uniqueid} completed successfully ---`);

    return new Response(audioBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    
    await writeToLog(LOG_COMPONENT, {
        level: 'CRITICAL_ERROR',
        message: 'An error occurred during the recording retrieval process.',
        uniqueid: uniqueid,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
    });

    if (errorMessage.includes('No such file')) {
        return NextResponse.json({ error: 'Recording file not found on the server.' }, { status: 404 });
    }
    if (errorMessage.includes('permission denied')) {
        return NextResponse.json({ error: 'Permission denied to access the recording file.' }, { status: 403 });
    }
     if (errorMessage.includes('Timed out')) {
        return NextResponse.json({ error: 'Connection to the recording server timed out.' }, { status: 504 });
    }
     if (errorMessage.includes('All configured authentication methods failed')) {
        return NextResponse.json({ error: 'Authentication failed. Check AMI username/password for SFTP.' }, { status: 401 });
     }

    return NextResponse.json({ error: 'Failed to retrieve recording', details: errorMessage }, { status: 500 });
  }
}
