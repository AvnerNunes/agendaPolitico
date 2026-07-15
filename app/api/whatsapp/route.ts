import { NextRequest, NextResponse } from 'next/server';
import { readState, writeState, markAwaiting, confirmLocation, saveMedia } from '@/lib/blob-state';
import { sendWhatsAppText, getGroupParticipants } from '@/lib/whapi';

const ONE_HOUR_MS = 60 * 60 * 1000;

function extFromMime(mimeType: string | undefined) {
  if (!mimeType) return 'bin';
  return mimeType.split('/')[1]?.split(';')[0] || 'bin';
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const message = body?.messages?.[0];

  if (!message) {
    console.log('[whatsapp] payload sem mensagem, ignorando', JSON.stringify(body).slice(0, 300));
    return NextResponse.json({ ignored: true, reason: 'sem mensagem no payload' });
  }

  const allowedGroupId = process.env.ALLOWED_GROUP_ID;
  const phone = message.from;
  const isFromAllowedGroup = message.chat_id === allowedGroupId;

  let authorized = isFromAllowedGroup;

  // Se não veio do grupo, só autoriza se quem mandou for membro do grupo
  if (!authorized && allowedGroupId) {
    const participants = await getGroupParticipants(allowedGroupId);
    authorized = participants.includes(phone);
  }

  console.log('[whatsapp] mensagem recebida', {
    type: message.type,
    phone,
    chatId: message.chat_id,
    allowedGroupId,
    isFromAllowedGroup,
    fromMe: message.from_me,
    authorized,
  });

  // Ignora mensagens enviadas por nós mesmos, e qualquer remetente não autorizado
  if (message.from_me || !authorized) {
    console.log('[whatsapp] ignorado: não autorizado');
    return NextResponse.json({ ignored: true });
  }

  // Se veio do grupo, responde no grupo (todo mundo vê); se veio no privado, responde só pra pessoa
  const replyTo = isFromAllowedGroup ? message.chat_id : phone;

  // Mensagem de texto -> confirma local
  if (message.type === 'text' && message.text?.body) {
    const { local, movedCount } = await confirmLocation(message.text.body);
    const readable = local.replace(/-/g, ' ');
    const extra = movedCount > 0 ? ` (${movedCount} arquivo${movedCount > 1 ? 's' : ''} organizado${movedCount > 1 ? 's' : ''})` : '';
    await sendWhatsAppText(replyTo, `Local definido: ${readable} ✅${extra}`);
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
    const filename = `${phone}_${message.id || Date.now()}.${extFromMime(mimeType)}`;

    if (needsQuestion) {
      await saveMedia(buffer, filename, mimeType || 'application/octet-stream', { direct: false });

      // Só pergunta se ainda não tiver perguntado (evita repetir a pergunta pra cada mídia do mesmo lote)
      if (!state.awaiting) {
        await markAwaiting();
        const question = state.local
          ? `As fotos são de ${state.local.replace(/-/g, ' ')} ou é um novo local? Me diga o nome do local.`
          : 'De que local são essas fotos/vídeos?';
        await sendWhatsAppText(replyTo, question);
      }
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
