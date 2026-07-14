import { NextRequest, NextResponse } from 'next/server';
import { readState, writeState, markAwaiting, confirmLocation, saveMedia } from '@/lib/blob-state';
import { sendWhatsAppText } from '@/lib/whapi';

const ONE_HOUR_MS = 60 * 60 * 1000;

function extFromMime(mimeType: string | undefined) {
  if (!mimeType) return 'bin';
  return mimeType.split('/')[1]?.split(';')[0] || 'bin';
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const message = body?.messages?.[0];

  if (!message) {
    return NextResponse.json({ ignored: true, reason: 'sem mensagem no payload' });
  }

  const allowedPhone = process.env.ALLOWED_PHONE;
  const phone = message.from;
  const isGroup = typeof message.chat_id === 'string' && message.chat_id.endsWith('@g.us');

  // Ignora grupos, mensagens enviadas por nós mesmos, e qualquer número não autorizado
  if (isGroup || message.from_me || !allowedPhone || phone !== allowedPhone) {
    return NextResponse.json({ ignored: true });
  }

  // Mensagem de texto -> confirma local
  if (message.type === 'text' && message.text?.body) {
    const { local, movedCount } = await confirmLocation(message.text.body);
    const readable = local.replace(/-/g, ' ');
    const extra = movedCount > 0 ? ` (${movedCount} arquivo${movedCount > 1 ? 's' : ''} organizado${movedCount > 1 ? 's' : ''})` : '';
    await sendWhatsAppText(phone, `Local definido: ${readable} ✅${extra}`);
    return NextResponse.json({ ok: true, local, movedCount });
  }

  // Mídia (imagem ou vídeo) -> organiza ou pergunta
  if (message.type === 'image' || message.type === 'video') {
    const media = message.image || message.video;
    const mediaUrl = media?.link;
    const mimeType = media?.mime_type;

    if (!mediaUrl) {
      return NextResponse.json({
        error: 'sem link de download (verifique se o Auto Download está ativado nas configurações do canal Whapi)',
      }, { status: 400 });
    }

    const state = await readState();
    const updatedAtMs = state.updatedAt ? new Date(state.updatedAt).getTime() : 0;
    const hoursSince = Date.now() - updatedAtMs;
    const needsQuestion = !state.local || hoursSince > ONE_HOUR_MS;

    const mediaRes = await fetch(mediaUrl);
    if (!mediaRes.ok) {
      return NextResponse.json({ error: 'falha ao baixar mídia' }, { status: 502 });
    }
    const buffer = await mediaRes.arrayBuffer();
    const filename = `${message.id || Date.now()}.${extFromMime(mimeType)}`;

    if (needsQuestion) {
      await saveMedia(buffer, filename, mimeType || 'application/octet-stream', { direct: false });
      await markAwaiting();
      const question = state.local
        ? `As fotos são de ${state.local.replace(/-/g, ' ')} ou é um novo local? Me diga o nome do local.`
        : 'De que local são essas fotos/vídeos?';
      await sendWhatsAppText(phone, question);
      return NextResponse.json({ pending: true });
    }

    const path = await saveMedia(buffer, filename, mimeType || 'application/octet-stream', {
      direct: true,
      local: state.local!,
    });
    await writeState({ ...state, updatedAt: new Date().toISOString() });
    return NextResponse.json({ saved: path });
  }

  return NextResponse.json({ ignored: true, reason: 'tipo de mensagem não suportado' });
}
