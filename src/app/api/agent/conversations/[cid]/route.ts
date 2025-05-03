import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
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

type CacheShape = Record<
  string,
  Record<string, string | { sid: string; title?: string; updatedAt?: string; log?: any[] }>
>;

async function loadCache(): Promise<CacheShape> {
  try {
    return JSON.parse(await fs.readFile(MAP_FILE, 'utf8') || '{}');
  } catch {
    return {};
  }
}
async function saveCache(c: CacheShape) {
  await fs.writeFile(MAP_FILE, JSON.stringify(c, null, 2));
}

/* --------------------------------------------------------------------- */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { cid: string } },
) {
  const cid = params.cid;
  const S = `/api/agent/conversations/${cid}[DELETE]`;

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

  /* mutate cache */
  const cache = await loadCache();
  if (!cache[uid] || !cache[uid][cid]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  delete cache[uid][cid];
  await saveCache(cache);

  log(S, 'deleted');
  /* 204 must NOT include a body */
  return new NextResponse(null, { status: 204 });
}