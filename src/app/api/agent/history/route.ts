import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { adminAuth } from '@/services/firebase/admin';

/* ── helpers ─────────────────────────────────────────────── */
const now = () => new Date().toISOString().split('T')[1];          // HH:MM:SS.mmm
const log = (scope: string, msg: string) => console.log(`[${now()}] ${scope}: ${msg}`);

function mkSessionId(userId: string, suffix = 'main'): string {
  const raw = `${userId}-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const trimmed = raw.replace(/^-+|-+$/g, '');
  return trimmed.length > 36 ? trimmed.slice(0, 36) : trimmed;     // enforce limit
}
/* ────────────────────────────────────────────────────────── */

interface HistoryMsg { sender: 'user' | 'bot'; text: string; id: string; }

export async function GET(req: NextRequest) {
  const S = '/api/agent/history';
  log(S, 'GET request');

  /* 1. Auth */
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    log(S, '❌ Missing Authorization header');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const idToken = authHeader.slice('Bearer '.length);
  let userId: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    userId = decoded.uid;
    log(S, `Auth OK – userId=${userId}`);
  } catch (e) {
    log(S, `❌ Token verification failed: ${(e as Error).message}`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  /* 2. Session‑ID */
  const sessionId = mkSessionId(userId);
  log(S, `Session ID="${sessionId}" (len=${sessionId.length})`);

  /* 3. Spawn Python */
  const pythonScript = path.resolve(process.cwd(), 'agent-backend', 'get_history.py');
  const pythonExe    = process.platform === 'win32' ? 'python' : 'python3';
  const args         = [pythonScript, userId, sessionId];
  log(S, `Spawning: ${pythonExe} ${args.map(a => JSON.stringify(a)).join(' ')}`);

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn(pythonExe, args);
    let out = '';
    let err = '';

    proc.stdout.on('data', d => {
      const t = d.toString();
      out += t;
      process.stdout.write(`[${now()}] PY-STDOUT: ${t}`);
    });
    proc.stderr.on('data', d => {
      const t = d.toString();
      err += t;
      process.stderr.write(`[${now()}] PY-STDERR: ${t}`);
    });

    proc.on('close', (code) => {
      log(S, `Python exited with code ${code}`);
      log(S, `Captured STDOUT (${out.length} chars)`);
      log(S, `Captured STDERR (${err.length} chars)`);

      if (code === 0) {
        try {
          const history: HistoryMsg[] = out.trim() ? JSON.parse(out) : [];
          return resolve(NextResponse.json({ history }));
        } catch (e) {
          log(S, `❌ JSON parse error: ${(e as Error).message}`);
          return resolve(NextResponse.json({ error: 'Parse error', raw: out }, { status: 500 }));
        }
      }
      return resolve(NextResponse.json({ error: 'History backend error', stderr: err }, { status: 500 }));
    });
  });
}