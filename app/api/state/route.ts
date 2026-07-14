import { NextRequest, NextResponse } from 'next/server';
import { readState, markAwaiting, confirmLocation } from '@/lib/blob-state';

function checkAuth(request: NextRequest) {
  const secret = request.headers.get('x-upload-secret');
  return !!secret && secret === process.env.UPLOAD_SECRET;
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

  if (body?.awaiting === true && !body?.local) {
    await markAwaiting();
    return NextResponse.json({ ok: true });
  }

  const rawLocal = body?.local;
  if (!rawLocal || typeof rawLocal !== 'string') {
    return NextResponse.json({ error: 'campo "local" é obrigatório' }, { status: 400 });
  }

  const result = await confirmLocation(rawLocal);
  return NextResponse.json(result);
}
