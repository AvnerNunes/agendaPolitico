import { put, get, list, del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

const STATE_PATH = '_state/current.json';
const PENDING_PREFIX = '_pending/';

function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function checkAuth(request: NextRequest) {
  const secret = request.headers.get('x-upload-secret');
  return !!secret && secret === process.env.UPLOAD_SECRET;
}

async function readState() {
  try {
    const response = await get(STATE_PATH, { access: 'private' });
    const text = await new Response(response.stream).text();
    return JSON.parse(text) as { local: string | null; updatedAt: string | null; awaiting: boolean };
  } catch {
    return { local: null, updatedAt: null, awaiting: false };
  }
}

async function writeState(state: { local: string | null; updatedAt: string | null; awaiting: boolean }) {
  await put(STATE_PATH, JSON.stringify(state), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }
  const state = await readState();
  return NextResponse.json(state);
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const body = await request.json();

  // Só marca que o robô está esperando resposta (não muda o local ainda)
  if (body?.awaiting === true && !body?.local) {
    const state = await readState();
    await writeState({ ...state, awaiting: true });
    return NextResponse.json({ ok: true });
  }

  // Confirma um local novo (resposta do coordenador) e move os arquivos pendentes
  const rawLocal = body?.local;
  if (!rawLocal || typeof rawLocal !== 'string') {
    return NextResponse.json({ error: 'campo "local" é obrigatório' }, { status: 400 });
  }

  const local = slugify(rawLocal);
  const today = new Date().toISOString().slice(0, 10);

  const { blobs: pending } = await list({ prefix: PENDING_PREFIX });
  let movedCount = 0;

  for (const file of pending) {
    const upstream = await fetch(file.url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!upstream.ok || !upstream.body) continue;

    const originalName = file.pathname.split('/').pop()!.replace(/^\d+-/, '');
    const newPath = `${local}/${today}/${originalName}`;

    await put(newPath, upstream.body, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: file.contentType,
    });
    await del(file.url);
    movedCount += 1;
  }

  await writeState({ local, updatedAt: new Date().toISOString(), awaiting: false });

  return NextResponse.json({ local, movedCount });
}
