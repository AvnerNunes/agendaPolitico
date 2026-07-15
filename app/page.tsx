import { list } from '@vercel/blob';
import { FolderControls } from '@/components/FolderControls';
import { DeleteFileButton } from '@/components/DeleteFileButton';

export const dynamic = 'force-dynamic';

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'avi'];

function extOf(pathname: string) {
  const clean = pathname.split('?')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPhone(phone: string) {
  // 556195689597 -> +55 61 99568-9597 (aproximado, sem validar DDD/formato exato)
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return `+${digits}`;
  const country = digits.slice(0, digits.length - 10);
  const ddd = digits.slice(digits.length - 10, digits.length - 8);
  const rest = digits.slice(digits.length - 8);
  const half = Math.ceil(rest.length / 2);
  return `+${country} ${ddd} ${rest.slice(0, half)}-${rest.slice(half)}`;
}

/** O robô salva os arquivos como "telefone_id.ext" — extrai o telefone daí, se existir. */
function parseSender(pathname: string) {
  const raw = pathname.split('/').pop() || 'arquivo';
  const match = raw.match(/^(\d{10,15})_(.+)$/);
  return { raw, senderPhone: match ? match[1] : null };
}

export default async function Home() {
  let blobs: Awaited<ReturnType<typeof list>>['blobs'] = [];
  let loadError: string | null = null;

  try {
    const result = await list();
    blobs = result.blobs;
  } catch (err) {
    loadError = 'Não foi possível ler o armazenamento. Confira o BLOB_READ_WRITE_TOKEN nas variáveis de ambiente.';
  }

  const folders = new Map<string, typeof blobs>();
  for (const blob of blobs) {
    const segments = blob.pathname.split('/');
    const folderName = segments.length > 1 ? segments[0] : 'sem-local';
    if (folderName.startsWith('_')) continue;
    if (!folders.has(folderName)) folders.set(folderName, []);
    folders.get(folderName)!.push(blob);
  }

  const sortedFolders = Array.from(folders.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    <main className="page">
      <div className="header">
        <h1>Zeca eventos — acervo</h1>
        <span className="count">{blobs.length} arquivos · {sortedFolders.length} locais</span>
      </div>

      {loadError && (
        <div className="empty">
          <p>Não deu pra carregar</p>
          <p>{loadError}</p>
        </div>
      )}

      {!loadError && sortedFolders.length === 0 && (
        <div className="empty">
          <p>Nenhum arquivo ainda</p>
          <p>Assim que o robô organizar as primeiras mídias, elas aparecem aqui.</p>
        </div>
      )}

      {sortedFolders.map(([folderName, files]) => {
        const latest = [...files].sort(
          (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        )[0];
        const { senderPhone: latestPhone } = parseSender(latest.pathname);

        return (
          <section className="folder" key={folderName}>
            <div className="folder-head">
              <div className="tag">
                <span className="dot" aria-hidden="true" />
                <span className="name">{folderName.replace(/-/g, ' ')}</span>
                {latestPhone && (
                  <span className="last-sender">
                    último envio: {formatPhone(latestPhone)} em {formatDateTime(latest.uploadedAt as unknown as string)}
                  </span>
                )}
              </div>
              <div className="folder-head-right">
                <span className="meta">{files.length} arquivos</span>
                <FolderControls folderName={folderName} />
              </div>
            </div>
            <div className="grid">
              {files.map((file) => {
                const ext = extOf(file.pathname);
                const isImage = IMAGE_EXT.includes(ext);
                const isVideo = VIDEO_EXT.includes(ext);
                const { raw: displayName, senderPhone } = parseSender(file.pathname);
                const viewUrl = `/api/view?url=${encodeURIComponent(file.url)}&name=${encodeURIComponent(displayName)}`;
                const downloadUrl = `/api/view?url=${encodeURIComponent(file.url)}&name=${encodeURIComponent(displayName)}&download=1`;
                return (
                  <div className="card" key={file.pathname}>
                    <a className="thumb" href={viewUrl} target="_blank" rel="noreferrer">
                      {isImage ? (
                        <img src={viewUrl} alt={displayName} loading="lazy" />
                      ) : isVideo ? (
                        <video src={viewUrl} muted playsInline preload="metadata" />
                      ) : (
                        <span className="glyph">{ext.toUpperCase() || 'ARQUIVO'}</span>
                      )}
                    </a>
                    <div className="card-meta">
                      {senderPhone && <span className="fphone">{formatPhone(senderPhone)}</span>}
                      <span className="fdate">{formatDateTime(file.uploadedAt as unknown as string)}</span>
                    </div>
                    <div className="card-actions">
                      <a href={viewUrl} target="_blank" rel="noreferrer">Abrir</a>
                      <a href={downloadUrl} download={displayName}>Baixar</a>
                    </div>
                    <DeleteFileButton url={file.url} filename={displayName} />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
