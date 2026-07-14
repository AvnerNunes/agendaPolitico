import { list } from '@vercel/blob';

export const dynamic = 'force-dynamic';

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'avi'];

function extOf(pathname: string) {
  const clean = pathname.split('?')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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

      {sortedFolders.map(([folderName, files]) => (
        <section className="folder" key={folderName}>
          <div className="folder-head">
            <div className="tag">
              <span className="dot" aria-hidden="true" />
              <span className="name">{folderName.replace(/-/g, ' ')}</span>
            </div>
            <span className="meta">{files.length} arquivos</span>
          </div>
          <div className="grid">
            {files.map((file) => {
              const ext = extOf(file.pathname);
              const isImage = IMAGE_EXT.includes(ext);
              const isVideo = VIDEO_EXT.includes(ext);
              const displayName = file.pathname.split('/').pop() || 'arquivo';
              const viewUrl = `/api/view?url=${encodeURIComponent(file.url)}&name=${encodeURIComponent(displayName)}`;
              const downloadUrl = `/api/view?url=${encodeURIComponent(file.url)}&name=${encodeURIComponent(displayName)}&download=1`;
              return (
                <div className="card" key={file.pathname}>
                  <a className="thumb" href={viewUrl} target="_blank" rel="noreferrer">
                    {isImage ? (
                      <img src={viewUrl} alt={displayName} loading="lazy" />
                    ) : (
                      <span className="glyph">{isVideo ? 'VÍDEO' : ext.toUpperCase() || 'ARQUIVO'}</span>
                    )}
                  </a>
                  <div className="card-meta">
                    <span className="fname">{displayName}</span>
                    <span className="fdate">{formatDate(file.uploadedAt as unknown as string)}</span>
                  </div>
                  <div className="card-actions">
                    <a href={viewUrl} target="_blank" rel="noreferrer">Abrir</a>
                    <a href={downloadUrl} download={displayName}>Baixar</a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
