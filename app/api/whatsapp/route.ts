import { NextRequest, NextResponse } from 'next/server';
import { readState, writeState, markAwaiting, confirmLocation, saveMedia } from '@/lib/blob-state';
import { sendWhatsAppText } from '@/lib/zapi';

const ONE_HOUR_MS = 60 * 60 * 1000;

function extFromMime(mimeType: string | undefined) {
  if (!mimeType) return 'bin';
  return mimeType.split('/')[1]?.split(';')[0] || 'bin';
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const allowedPhone = process.env.ALLOWED_PHONE;
  const phone = body?.phone;

  // Ignora grupos, mensagens enviadas por nós mesmos, e qualquer número não autorizado
  if (body?.isGroup || body?.fromMe || !allowedPhone || phone !== allowedPhone) {
    return NextResponse.json({ ignored: true });
  }

  // Mensagem de texto -> confirma local
  const textMessage = body?.text?.message;
  if (textMessage) {
    const { local, movedCount } = await confirmLocation(textMessage);
    const readable = local.replace(/-/g, ' ');
    const extra = movedCount > 0 ? ` (${movedCount} arquivo${movedCount > 1 ? 's' : ''} organizado${movedCount > 1 ? 's' : ''})` : '';
    await sendWhatsAppText(phone, `Local definido: ${readable} ✅${extra}`);
    return NextResponse.json({ ok: true, local, movedCount });
  }

  // Mídia (imagem ou vídeo) -> organiza ou pergunta
  const media = body?.image || body?.video;
  if (media) {
    const mediaUrl = body.image?.imageUrl || body.video?.videoUrl;
    const mimeType = body.image?.mimeType || body.video?.mimeType;
    if (!mediaUrl) {
      return NextResponse.json({ error: 'sem url de mídia' }, { status: 400 });
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
    const filename = `${body.messageId || Date.now()}.${extFromMime(mimeType)}`;

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
