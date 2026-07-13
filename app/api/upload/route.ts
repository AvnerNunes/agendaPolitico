import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-upload-secret');
  if (!secret || secret !== process.env.UPLOAD_SECRET) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const pathname = request.nextUrl.searchParams.get('pathname');
  if (!pathname) {
    return NextResponse.json({ error: 'pathname é obrigatório' }, { status: 400 });
  }

  const blob = await put(pathname, request.body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return NextResponse.json(blob);
}
