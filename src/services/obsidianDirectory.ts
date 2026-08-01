import { Directory, File } from 'expo-file-system';
import type { Book } from '../types/book';
import {
  buildObsidianNote,
  dogEarAttachmentName,
  OBSIDIAN_ATTACHMENTS_FOLDER,
  OBSIDIAN_FOLDER,
} from './obsidianExport';

export interface ObsidianDirectorySelection {
  uri: string;
  name: string;
}

export interface ObsidianDirectoryExportResult {
  noteName: string;
  imageCount: number;
}

function isDirectory(entry: File | Directory): entry is Directory {
  return entry instanceof Directory;
}

function childDirectory(parent: Directory, name: string): Directory {
  const existing = parent.list().find((entry) => isDirectory(entry) && entry.name === name);
  return existing && isDirectory(existing) ? existing : parent.createDirectory(name);
}

function removeFileIfPresent(directory: Directory, name: string): void {
  const existing = directory.list().find((entry) => !isDirectory(entry) && entry.name === name);
  if (existing && !isDirectory(existing)) existing.delete();
}

function mimeTypeForName(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'svg') return 'image/svg+xml';
  if (extension === 'avif') return 'image/avif';
  if (extension === 'bmp') return 'image/bmp';
  return 'image/jpeg';
}

function writeReplacing(
  directory: Directory,
  name: string,
  mimeType: string,
  content: string | Uint8Array,
): File {
  removeFileIfPresent(directory, name);
  const file = directory.createFile(name, mimeType);
  file.write(content);
  return file;
}

/** Androidのシステム選択画面でVaultのルートフォルダへの永続アクセスを得る。 */
export async function pickObsidianVaultDirectory(
  initialUri?: string,
): Promise<ObsidianDirectorySelection> {
  const directory = await Directory.pickDirectoryAsync(initialUri);
  // list()で、選択直後に実際の読み書き対象として利用できることを確認する。
  directory.list();
  return { uri: directory.uri, name: directory.name };
}

export function canAccessObsidianDirectory(uri: string): boolean {
  try {
    const directory = new Directory(uri);
    if (!directory.exists) return false;
    directory.list();
    return true;
  } catch {
    return false;
  }
}

/** 選択済みVaultへMarkdownと画像を直接書き出す。画像を先に書いてからノートを更新する。 */
export async function exportBookToObsidianDirectory(
  book: Book,
  rootUri: string,
  now = new Date(),
): Promise<ObsidianDirectoryExportResult> {
  const root = new Directory(rootUri);
  if (!root.exists) throw new Error('選択したVaultフォルダへアクセスできません。設定で選び直してください。');

  const noteDirectory = childDirectory(root, OBSIDIAN_FOLDER);
  const attachments = childDirectory(noteDirectory, OBSIDIAN_ATTACHMENTS_FOLDER);
  const imageNames: Record<string, string> = {};

  for (const dogEar of book.dogEars) {
    if (dogEar.deletedAt || !dogEar.photoUri) continue;
    const source = new File(dogEar.photoUri);
    if (!source.exists) {
      throw new Error(`P.${dogEar.page || '—'} の画像を読み取れません。画像を選び直してください。`);
    }
    const name = dogEarAttachmentName(book.id, dogEar.id, dogEar.photoUri);
    writeReplacing(attachments, name, mimeTypeForName(name), await source.bytes());
    imageNames[dogEar.id] = name;
  }

  const note = buildObsidianNote(book, now, { dogEarImages: imageNames });
  writeReplacing(noteDirectory, `${note.name}.md`, 'text/markdown', note.content);
  return { noteName: note.name, imageCount: Object.keys(imageNames).length };
}

export function isDirectoryPickerCancellation(error: unknown): boolean {
  return error instanceof Error && /picker was cancelled|picker.*cancel/i.test(error.message);
}
