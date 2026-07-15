import { put, get, list, del } from '@vercel/blob';

const STATE_PATH = '_state/current.json';
const PENDING_PREFIX = '_pending/';

export type SenderState = {
  local: string | null;
  updatedAt: string | null;
  awaiting: boolean;
};

type StateMap = Record<string, SenderState>;

const EMPTY_SENDER_STATE: SenderState = { local: null, updatedAt: null, awaiting: false };

export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Data de "hoje" no fuso de Brasília, no formato YYYY-MM-DD. */
export function brazilToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

async function readStateMap(): Promise<StateMap> {
  try {
    const response = await get(STATE_PATH, { access: 'private' });
    const text = await new Response(response.stream).text();
    return JSON.parse(text) as StateMap;
  } catch {
    return {};
  }
}

async function writeStateMap(map: StateMap) {
  await put(STATE_PATH, JSON.stringify(map), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

/** Estado do local ativo, controlado individualmente por número de telefone. */
export async function getSenderState(phone: string): Promise<SenderState> {
  const map = await readStateMap();
  return map[phone] || EMPTY_SENDER_STATE;
}

export async function markAwaiting(phone: string) {
  const map = await readStateMap();
  map[phone] = { ...(map[phone] || EMPTY_SENDER_STATE), awaiting: true };
  await writeStateMap(map);
}

/** Atualiza só o "relógio" (usado quando uma mídia é salva direto, sem perguntar). */
export async function touchSenderState(phone: string) {
  const map = await readStateMap();
  map[phone] = { ...(map[phone] || EMPTY_SENDER_STATE), updatedAt: new Date().toISOString() };
  await writeStateMap(map);
}

/** Confirma um novo local pra esse número, e move os arquivos pendentes DELE (só dele). */
export async function confirmLocation(phone: string, rawLocal: string) {
  const local = slugify(rawLocal);
  const today = brazilToday();

  const { blobs: allPending } = await list({ prefix: PENDING_PREFIX });
  const mine = allPending.filter((file) => {
    const name = file.pathname.slice(PENDING_PREFIX.length); // "<timestamp>-<phone>_<id>.ext"
    return name.includes(`-${phone}_`);
  });

  let movedCount = 0;
  for (const file of mine) {
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

  const map = await readStateMap();
  map[phone] = { local, updatedAt: new Date().toISOString(), awaiting: false };
  await writeStateMap(map);

  return { local, movedCount };
}

/** Usado ao renomear uma pasta no site: atualiza a referência em todos os números que apontavam pra ela. */
export async function renameLocationEverywhere(oldName: string, newName: string) {
  const map = await readStateMap();
  let changed = false;
  for (const phone of Object.keys(map)) {
    if (map[phone].local === oldName) {
      map[phone] = { ...map[phone], local: newName };
      changed = true;
    }
  }
  if (changed) await writeStateMap(map);
}

/** Salva uma mídia nova. Se `direct` for true, vai direto pra pasta final; senão fica em _pending/. */
export async function saveMedia(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  destination: { direct: true; local: string } | { direct: false }
) {
  const today = brazilToday();
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
