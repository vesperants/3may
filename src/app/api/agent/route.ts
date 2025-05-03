import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { adminAuth } from '@/services/firebase/admin';

/* helpers ------------------------------------------------------------- */
const now = () => new Date().toISOString().split('T')[1];
const log = (scope: string, msg: string) => console.log(`[${now()}] ${scope}: ${msg}`);

interface MessagePayload { message: string; cid: string; }

export async function POST(req: NextRequest) {
  const S = '/api/agent';
  log(S, 'POST request');

  /* 1 · auth ----------------------------------------------------------- */
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

  /* 2 · body ----------------------------------------------------------- */
  let message: string, cid: string;
  try {
    const body = (await req.json()) as MessagePayload;
    message = body.message?.trim();
    cid     = body.cid?.trim();
    if (!message) throw new Error('Empty message');
    if (!cid)     throw new Error('Missing cid');
    log(S, `cid="${cid}"  msg="${message.slice(0, 80)}..."`);
  } catch (e) {
    log(S, `❌ Bad request: ${(e as Error).message}`);
    return NextResponse.json({ reply: 'Bad request' }, { status: 400 });
  }

  /* 3 · spawn python -------------------------------------------------- */
  const pythonScript = path.resolve(process.cwd(), 'agent-backend', 'gemini_agent.py');
  const pythonExe    = process.platform === 'win32' ? 'python' : 'python3';
  const args         = [pythonScript, userId, cid, message];
  log(S, `Spawning: ${pythonExe} ${args.map(a => JSON.stringify(a)).join(' ')}`);

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(pythonExe, args);
    let reply = '';
    let err   = '';

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