import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { adminAuth } from '@/services/firebase/admin';

/* helpers ------------------------------------------------------------- */
const now = () => new Date().toISOString().split('T')[1];
const log = (scope: string, msg: string) => console.log(`[${now()}] ${scope}: ${msg}`);

interface MessagePayload { 
  message: string; 
  cid: string; 
  selectedCaseIds?: string[]; 
}

export async function POST(req: NextRequest) {
  const S = '/api/agent';
  log(S, 'POST request');

  /* 1 · auth ----------------------------------------------------------- */
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    log(S, '❌ Missing Authorization header');
    return NextResponse.json({ reply: 'Unauthorized' }, { status: 401 });
  }
  const idToken = authHeader.slice('Bearer '.length);
  let userId: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    userId = decoded.uid;
    log(S, `Auth OK – userId=${userId}`);
  } catch (e) {
    log(S, `❌ Token verification failed: ${(e as Error).message}`);
    return NextResponse.json({ reply: 'Unauthorized' }, { status: 401 });
  }

  /* 2 · body ----------------------------------------------------------- */
  let message: string, cid: string, selectedCaseIds: string[] | undefined;
  try {
    const body = (await req.json()) as MessagePayload;
    message = body.message?.trim();
    cid = body.cid?.trim();
    selectedCaseIds = body.selectedCaseIds;
    if (!message) throw new Error('Empty message');
    if (!cid) throw new Error('Missing cid');
    log(S, `cid="${cid}"  msg="${message.slice(0, 80)}..."`);
    if (selectedCaseIds?.length) {
      log(S, `Selected case IDs: ${selectedCaseIds.join(', ')}`);
    }
  } catch (e) {
    log(S, `❌ Bad request: ${(e as Error).message}`);
    return NextResponse.json({ reply: 'Bad request' }, { status: 400 });
  }

  /* 3 · spawn python -------------------------------------------------- */
  const pythonScript = path.resolve(process.cwd(), 'agent-backend', 'gemini_agent.py');
  const wrapperScript = path.resolve(process.cwd(), 'agent-backend', 'run_script.sh');
  const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
  
  // Base arguments
  const baseArgs = [userId, cid, message];
  
  // Add selectedCaseIds as a JSON string if present
  if (selectedCaseIds?.length) {
    // Ensure JSON is properly formatted and escaped for command line
    const jsonString = JSON.stringify(selectedCaseIds);
    log(S, `JSON string for case IDs (before escaping): ${jsonString}`);
    
    // Special handling for Windows vs Unix
    if (process.platform === 'win32') {
      // For Windows, wrap in double quotes and escape inner quotes
      const escapedJson = `"${jsonString.replace(/"/g, '\\"')}"`;
      baseArgs.push(escapedJson);
      log(S, `Windows escaped JSON: ${escapedJson}`);
    } else {
      // For Unix, single quotes are safer
      baseArgs.push(jsonString);
      log(S, `Unix JSON: ${jsonString}`);
    }
  }
  
  const args = process.platform === 'win32' 
    ? [pythonScript, ...baseArgs]
    : ['gemini_agent.py', ...baseArgs];
  const spawnCmd = process.platform === 'win32' ? pythonExe : wrapperScript;
  
  log(S, `Spawning: ${spawnCmd} ${args.map(a => JSON.stringify(a)).join(' ')}`);

  /* 4 · call python agent via API */
  log(S, 'spawn python with args: ' + [userId, cid, message].map(x => `"${x}"`).join(', '));
  
  // Log if we have selected case IDs
  if (selectedCaseIds?.length) {
    log(S, `====== API ROUTE DEBUG ======`);
    log(S, `Selected case IDs found in request: ${selectedCaseIds.length}`);
    log(S, `Selected case IDs: ${JSON.stringify(selectedCaseIds)}`);
    log(S, `Message being sent: "${message}"`);
    log(S, `Full args to be passed: ${JSON.stringify(baseArgs)}`);
    log(S, `===========================`);
  }

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(spawnCmd, args);
    let reply = '';
    let err = '';

    proc.stdout.on('data', d => {
      const t = d.toString();
      reply += t;
      process.stdout.write(`[${now()}] PY-STDOUT: ${t}`);
    });
    proc.stderr.on('data', d => {
      const t = d.toString();
      err += t;
      process.stderr.write(`[${now()}] PY-STDERR: ${t}`);
    });

    proc.on('close', (code) => {
      log(S, `Python exited with code ${code}`);
      if (code === 0) {
        return resolve(NextResponse.json({ reply: reply.trim() }));
      }
      return resolve(NextResponse.json(
        { reply: 'Agent backend error', stderr: err },
        { status: 500 },
      ));
    });
  });
}