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
