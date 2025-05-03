import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { adminAuth } from '@/services/firebase/admin';

/* helpers -------------------------------------------------------------- */
const MAP_FILE = path.resolve(
  process.cwd(),
  'agent-backend',
  'session_map.json',
);
const now = () => new Date().toISOString().split('T')[1];
const log = (tag: string, msg: string) =>
  console.log(`[${now()}] ${tag}: ${msg}`);

interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: string;
}

type CacheShape = Record<
  string,
  Record<
    string,
    string | { sid: string; title?: string; updatedAt?: string; log?: any[] }
  >
>;

async function loadCache(): Promise<CacheShape> {
  try {
    const txt = await fs.readFile(MAP_FILE, 'utf8');
    return JSON.parse(txt || '{}');
  } catch {
    return {};
  }
}
async function saveCache(c: CacheShape) {
  await fs.writeFile(MAP_FILE, JSON.stringify(c, null, 2));
}

/* ----------------------------- GET -------------------------------- */
export async function GET(req: NextRequest) {
  const S = '/api/agent/conversations[GET]';

  /* auth */
  const hdr = req.headers.get('Authorization');
  if (!hdr?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(hdr.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  /* list & sort */
  const cache = await loadCache();
  const userConv = cache[uid] ?? {};
  const list: ConversationMeta[] = Object.entries(userConv)
    .map(([cid, val]) => {
      const meta = typeof val === 'string' ? {} : (val as any);
      return {
        id: cid,
        title: meta.title ?? 'Untitled Chat',
        updatedAt: meta.updatedAt ?? '',
      };
    })
    .sort((a, b) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || ''),
    );

  log(S, `returning ${list.length} convos`);
  return NextResponse.json({ conversations: list });
}

/* ----------------------------- POST -------------------------------- */
export async function POST(req: NextRequest) {
  const S = '/api/agent/conversations[POST]';

  /* auth */
  const hdr = req.headers.get('Authorization');
  if (!hdr?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(hdr.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  /* optional title */
  let title = 'Untitled Chat';
  try {
    const body = (await req.json()) ?? {};
    if (typeof body.title === 'string' && body.title.trim()) {
      title = body.title.trim().slice(0, 60);
    }
  } catch {
    /* ignore */
  }

  /* mutate cache */
  const cache = await loadCache();
  const userConv = cache[uid] ?? {};

  const cid = crypto.randomUUID().slice(0, 8);
  userConv[cid] = {
    sid: '',                      // python helper will create on first msg
    title,
    updatedAt: new Date().toISOString(),
    log: [],
  };
  cache[uid] = userConv;
  await saveCache(cache);

  log(S, `created cid=${cid}`);
  return NextResponse.json({ id: cid, title });
}