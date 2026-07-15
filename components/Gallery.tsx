'use client';

import { useMemo, useState } from 'react';
import { FolderControls } from './FolderControls';
import { DeleteFileButton } from './DeleteFileButton';

type FileEntry = { pathname: string; url: string; uploadedAt: string };
type FolderEntry = { folderName: string; files: FileEntry[] };

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'avi'];

function extOf(pathname: string) {
  const clean = pathname.split('?')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return `+${digits}`;
  const country = digits.slice(0, digits.length - 10);
  const ddd = digits.slice(digits.length - 10, digits.length - 8);
  const rest = digits.slice(digits.length - 8);
  const half = Math.ceil(rest.length / 2);
  return `+${country} ${ddd} ${rest.slice(0, half)}-${rest.slice(half)}`;
}

function parseSender(pathname: string) {
  const raw = pathname.split('/').pop() || 'arquivo';
  const match = raw.match(/^(\d{10,15})_(.+)$/);
  return { raw, senderPhone: match ? match[1] : null };
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function fileDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function Gallery({ folders }: { folders: FolderEntry[] }) {
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    return folders
      .map((folder) => {
        const files = dateFilter
          ? folder.files.filter((f) => fileDate(f.uploadedAt) === dateFilter)
          : folder.files;
        return { ...folder, files };
      })
      .filter((folder) => {
        if (folder.files.length === 0) return false;
        if (!term) return true;
        return normalize(folder.folderName.replace(/-/g, ' ')).includes(term);
      });
  }, [folders, search, dateFilter]);

  return (
    <>
      <div className="filters">
        <input
          type="text"
          placeholder="Buscar por local..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        {(search || dateFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setDateFilter('');
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="empty">
          <p>Nenhum resultado</p>
          <p>Tente outro termo de busca ou outra data.</p>
        </div>
      )}

      {filtered.map(({ folderName, files }) => {
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
                    último envio: {formatPhone(latestPhone)} em {formatDateTime(latest.uploadedAt)}
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
                      <span className="fdate">{formatDateTime(file.uploadedAt)}</span>
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
    </>
  );
}
