import { NextRequest, NextResponse } from 'next/server';
import { getSenderState, markAwaiting, confirmLocation } from '@/lib/blob-state';

function checkAuth(request: NextRequest) {
  const secret = request.headers.get('x-upload-secret');
  return !!secret && secret === process.env.UPLOAD_SECRET;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }
  const phone = request.nextUrl.searchParams.get('phone');
  if (!phone) {
    return NextResponse.json({ error: 'query "phone" é obrigatória' }, { status: 400 });
  }
  const state = await getSenderState(phone);
  return NextResponse.json(state);
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const phone = body?.phone;
  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'campo "phone" é obrigatório' }, { status: 400 });
  }

  if (body?.awaiting === true && !body?.local) {
    await markAwaiting(phone);
    return NextResponse.json({ ok: true });
  }

  const rawLocal = body?.local;
  if (!rawLocal || typeof rawLocal !== 'string') {
    return NextResponse.json({ error: 'campo "local" é obrigatório' }, { status: 400 });
  }

  const result = await confirmLocation(phone, rawLocal);
  return NextResponse.json(result);
}
