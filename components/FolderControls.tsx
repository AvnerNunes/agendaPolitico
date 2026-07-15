'use client';

import { useState } from 'react';
import { renameFolderAction, deleteFolderAction } from '@/app/actions';

export function FolderControls({ folderName }: { folderName: string }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (editing) {
    return (
      <form
        className="folder-edit-form"
        action={async (formData) => {
          setBusy(true);
          await renameFolderAction(folderName, formData);
          setBusy(false);
          setEditing(false);
        }}
      >
        <input
          name="newName"
          defaultValue={folderName.replace(/-/g, ' ')}
          autoFocus
          disabled={busy}
        />
        <button type="submit" disabled={busy}>{busy ? '...' : 'Salvar'}</button>
        <button type="button" onClick={() => setEditing(false)} disabled={busy}>
          Cancelar
        </button>
      </form>
    );
  }

  return (
    <div className="folder-controls">
      <button type="button" onClick={() => setEditing(true)} title="Editar nome do local">
        ✎
      </button>
      <button
        type="button"
        title="Excluir pasta inteira"
        onClick={async () => {
          if (!confirm(`Excluir TODA a pasta "${folderName.replace(/-/g, ' ')}"? Isso apaga todos os arquivos dela permanentemente.`)) {
            return;
          }
          setBusy(true);
          await deleteFolderAction(folderName);
          setBusy(false);
        }}
        disabled={busy}
      >
        {busy ? '...' : '🗑'}
      </button>
    </div>
  );
}
