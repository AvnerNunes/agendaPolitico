import { put, get } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

const STATE_PATH = '_state/current.json';

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

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  try {
    const response = await get(STATE_PATH, { access: 'private' });
    const text = await new Response(response.stream).text();
    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ local: 'sem-local' });
  }
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const rawLocal = body?.local;
  if (!rawLocal || typeof rawLocal !== 'string') {
    return NextResponse.json({ error: 'campo "local" é obrigatório' }, { status: 400 });
  }

  const local = slugify(rawLocal);
  await put(STATE_PATH, JSON.stringify({ local, updatedAt: new Date().toISOString() }), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });

  return NextResponse.json({ local });
}
