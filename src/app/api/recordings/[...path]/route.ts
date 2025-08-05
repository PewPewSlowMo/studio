// src/app/api/recordings/[...path]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/actions/config';
import { getCallById } from '@/actions/cdr';
import SftpClient from 'ssh2-sftp-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const uniqueid = params.path[0];
  if (!uniqueid) {
    return NextResponse.json({ error: 'Call UniqueID is required' }, { status: 400 });
  }

  try {
    const config = await getConfig();

    // 1. Fetch the call details from CDR DB to get the recordingfile
    const callResult = await getCallById(config.cdr, uniqueid);
    if (!callResult.success || !callResult.data) {
      return NextResponse.json({ error: 'Call not found in CDR' }, { status: 404 });
    }
    const { recordingfile } = callResult.data;

    if (!recordingfile) {
      return NextResponse.json({ error: 'No recording file associated with this call' }, { status: 404 });
    }

    // 2. Construct the full path on the remote server, similar to FreePBX logic
    const rec_parts = recordingfile.split('-');
    // Example filename: internal-0001-0777-20250711-121514-1752218114.361.wav
    // This logic is fragile, but it's a common pattern for FreePBX.
    // We assume the date part is always at the same index.
    if (rec_parts.length < 4) {
        throw new Error('Recording filename format is unexpected and date cannot be parsed.');
    }
    
    const datePart = rec_parts.find(p => p.length === 8 && !isNaN(parseInt(p)));

    if (!datePart) {
      throw new Error(`Could not determine date part from filename: ${recordingfile}`);
    }

    const fyear = datePart.substring(0, 4); // "2025"
    const fmonth = datePart.substring(4, 6); // "07"
    const fday = datePart.substring(6, 8);   // "11"
    
    // Assuming standard FreePBX monitor directory
    const monitor_base = `/var/spool/asterisk/monitor`; 
    const remotePath = `${monitor_base}/${fyear}/${fmonth}/${fday}/${recordingfile}`;

    // 3. Connect via SFTP and download the file
    const sftp = new SftpClient();
    // We use AMI config for SSH, assuming it's the same server. 
    // This could be a separate config in the future.
    const sftpConfig = {
      host: config.ami.host,
      port: 22, // Standard SSH port, explicitly set
      username: config.ami.username,
      password: config.ami.password,
    };

    await sftp.connect(sftpConfig);

    // 4. Get the file as a buffer
    const audioBuffer = await sftp.get(remotePath);
    await sftp.end();

    if (!(audioBuffer instanceof Buffer)) {
        throw new Error('Failed to download file, received unexpected type.');
    }

    // 5. Stream the file back to the client
    const headers = new Headers();
    // Heuristic for content type based on extension
    const contentType = recordingfile.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', audioBuffer.length.toString());

    return new Response(audioBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error(`[SFTP RECORDING ERROR] for ${uniqueid}:`, error);
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    
    // Provide more specific error messages based on common SFTP errors
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
