import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const download = request.nextUrl.searchParams.get('download');
  const filename = request.nextUrl.searchParams.get('name') || 'arquivo';

  if (!url || !url.includes('.blob.vercel-storage.com')) {
    return NextResponse.json({ error: 'url inválida' }, { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'token não configurado' }, { status: 500 });
  }

  const upstream = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'arquivo não encontrado' }, { status: upstream.status });
  }

  const disposition = download
    ? `attachment; filename="${filename}"`
    : `inline; filename="${filename}"`;

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': disposition,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
