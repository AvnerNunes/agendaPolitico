import { put, get, list, del } from '@vercel/blob';

const STATE_PATH = '_state/current.json';
const PENDING_PREFIX = '_pending/';

export type BotState = {
  local: string | null;
  updatedAt: string | null;
  awaiting: boolean;
};

export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function readState(): Promise<BotState> {
  try {
    const response = await get(STATE_PATH, { access: 'private' });
    const text = await new Response(response.stream).text();
    return JSON.parse(text) as BotState;
  } catch {
    return { local: null, updatedAt: null, awaiting: false };
  }
}

export async function writeState(state: BotState) {
  await put(STATE_PATH, JSON.stringify(state), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export async function markAwaiting() {
  const state = await readState();
  await writeState({ ...state, awaiting: true });
}

/** Confirma um novo local e move qualquer arquivo pendente pra pasta certa. */
export async function confirmLocation(rawLocal: string) {
  const local = slugify(rawLocal);
  const today = new Date().toISOString().slice(0, 10);

  const { blobs: pending } = await list({ prefix: PENDING_PREFIX });
  let movedCount = 0;

  for (const file of pending) {
    const upstream = await fetch(file.url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!upstream.ok || !upstream.body) continue;

    const originalName = file.pathname.split('/').pop()!.replace(/^\d+-/, '');
    const newPath = `${local}/${today}/${originalName}`;

    await put(newPath, upstream.body, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: upstream.headers.get('content-type') || 'application/octet-stream',
    });
    await del(file.url);
    movedCount += 1;
  }

  await writeState({ local, updatedAt: new Date().toISOString(), awaiting: false });
  return { local, movedCount };
}

/** Salva uma mídia nova. Se `direct` for true, vai direto pra pasta final; senão fica em _pending/. */
export async function saveMedia(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  destination: { direct: true; local: string } | { direct: false }
) {
  const today = new Date().toISOString().slice(0, 10);
  const path = destination.direct
    ? `${destination.local}/${today}/${filename}`
    : `${PENDING_PREFIX}${Date.now()}-${filename}`;

  await put(path, buffer, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: mimeType,
  });

  return path;
}
