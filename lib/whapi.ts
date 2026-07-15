export async function sendWhatsAppText(to: string, message: string) {
  const token = process.env.WHAPI_TOKEN;

  if (!token) {
    console.error('WHAPI_TOKEN não configurado');
    return;
  }

  await fetch('https://gate.whapi.cloud/messages/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, body: message }),
  });
}

/** Retorna os números (sem @c.us/@s.whatsapp.net) dos participantes de um grupo. */
export async function getGroupParticipants(groupId: string): Promise<string[]> {
  const token = process.env.WHAPI_TOKEN;
  if (!token) {
    console.error('WHAPI_TOKEN não configurado');
    return [];
  }

  const res = await fetch(`https://gate.whapi.cloud/groups/${groupId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error('[whapi] falha ao buscar participantes do grupo', res.status);
    return [];
  }

  const data = await res.json();
  const participants = data?.participants || [];
  return participants.map((p: { id: string }) => p.id);
}
