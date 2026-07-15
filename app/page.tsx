import { list } from '@vercel/blob';
import { Gallery } from '@/components/Gallery';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let blobs: Awaited<ReturnType<typeof list>>['blobs'] = [];
  let loadError: string | null = null;

  try {
    const result = await list();
    blobs = result.blobs;
  } catch (err) {
    loadError = 'Não foi possível ler o armazenamento. Confira o BLOB_READ_WRITE_TOKEN nas variáveis de ambiente.';
  }

  const folders = new Map<string, { pathname: string; url: string; uploadedAt: string }[]>();
  for (const blob of blobs) {
    const segments = blob.pathname.split('/');
    const folderName = segments.length > 1 ? segments[0] : 'sem-local';
    if (folderName.startsWith('_')) continue;
    if (!folders.has(folderName)) folders.set(folderName, []);
    folders.get(folderName)!.push({
      pathname: blob.pathname,
      url: blob.url,
      uploadedAt: new Date(blob.uploadedAt).toISOString(),
    });
  }

  const sortedFolders = Array.from(folders.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([folderName, files]) => ({ folderName, files }));

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

      {!loadError && sortedFolders.length > 0 && <Gallery folders={sortedFolders} />}
    </main>
  );
}
