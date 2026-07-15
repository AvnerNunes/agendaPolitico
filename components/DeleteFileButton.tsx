'use client';

import { useState } from 'react';
import { deleteFileAction } from '@/app/actions';

export function DeleteFileButton({ url, filename }: { url: string; filename: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="delete-file-btn"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Excluir "${filename}" permanentemente?`)) return;
        setBusy(true);
        await deleteFileAction(url);
      }}
    >
      {busy ? '...' : 'Excluir'}
    </button>
  );
}
