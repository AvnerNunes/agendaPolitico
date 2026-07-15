'use server';

import { list, del, put } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { renameLocationEverywhere, slugify } from '@/lib/blob-state';

export async function renameFolderAction(oldName: string, formData: FormData) {
  const rawNewName = formData.get('newName');
  if (typeof rawNewName !== 'string' || !rawNewName.trim()) return;

  const newName = slugify(rawNewName);
  if (!newName || newName === oldName) return;

  const { blobs } = await list({ prefix: `${oldName}/` });

  for (const file of blobs) {
    const rest = file.pathname.slice(oldName.length); // ex: "/2026-07-14/foto.jpg"
    const newPath = `${newName}${rest}`;

    const upstream = await fetch(file.url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!upstream.ok || !upstream.body) continue;

    await put(newPath, upstream.body, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: upstream.headers.get('content-type') || 'application/octet-stream',
    });
    await del(file.url);
  }

  // Se essa pasta era o "local ativo" de algum número, atualiza a referência
  await renameLocationEverywhere(oldName, newName);

  revalidatePath('/');
}

export async function deleteFolderAction(folderName: string) {
  const { blobs } = await list({ prefix: `${folderName}/` });
  await Promise.all(blobs.map((file) => del(file.url)));
  revalidatePath('/');
}

export async function deleteFileAction(url: string) {
  await del(url);
  revalidatePath('/');
}
