import { describe, expect, it } from 'vitest';
import { createFolder, deleteFolder, ensureFolderShareCode, getFolder, renameFolder } from './folder-store';

describe('folder-store (in-memory fallback)', () => {
  it('creates, fetches, renames, and deletes a folder', async () => {
    const folder = await createFolder('Original name');
    expect(folder.id).toBeTruthy();

    const fetched = await getFolder(folder.id);
    expect(fetched?.name).toBe('Original name');

    const renamed = await renameFolder(folder.id, 'New name');
    expect(renamed?.name).toBe('New name');

    const deleted = await deleteFolder(folder.id);
    expect(deleted).toBe(true);

    const goneNow = await getFolder(folder.id);
    expect(goneNow).toBeNull();
  });

  it('only generates one share code even if requested concurrently', async () => {
    const folder = await createFolder('Shared folder');

    const [codeA, codeB] = await Promise.all([
      ensureFolderShareCode(folder.id),
      ensureFolderShareCode(folder.id),
    ]);

    expect(codeA).toBeTruthy();
    expect(codeA).toBe(codeB);
  });
});
