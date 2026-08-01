import { Directory, File, Paths } from 'expo-file-system';

const DOG_EAR_IMAGE_FOLDER = 'dog-ear-images';
const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const SUPPORTED_EXTENSIONS = new Set(Object.values(MIME_EXTENSIONS));

export interface PendingDogEarImage {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 64) || 'dogear';
}

export function imageExtension(image: PendingDogEarImage): string {
  const byMime = image.mimeType ? MIME_EXTENSIONS[image.mimeType.toLowerCase()] : undefined;
  if (byMime) return byMime;

  const candidate = image.fileName || image.uri.split(/[?#]/, 1)[0];
  const match = candidate.match(/\.([A-Za-z0-9]+)$/);
  const raw = match?.[1]?.toLowerCase();
  const extension = raw === 'jpeg' ? 'jpg' : raw;
  if (extension && SUPPORTED_EXTENSIONS.has(extension)) return extension;

  throw new Error('この画像形式は保存できません。JPG、PNG、WebPなどを選んでください。');
}

function imageDirectory(): Directory {
  const directory = new Directory(Paths.document, DOG_EAR_IMAGE_FOLDER);
  if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
  return directory;
}

/** ImagePickerの一時ファイルを、OSが消さないアプリのdocument領域へコピーする。 */
export async function persistDogEarImage(
  image: PendingDogEarImage,
  dogEarId: string,
): Promise<string> {
  const source = new File(image.uri);
  if (!source.exists) throw new Error('選択した画像を読み取れません。もう一度選んでください。');

  const target = new File(
    imageDirectory(),
    `${safeId(dogEarId)}-${Date.now()}.${imageExtension(image)}`,
  );
  await source.copy(target);
  return target.uri;
}

export function imageMimeType(image: PendingDogEarImage): string {
  const normalized = image.mimeType?.split(';', 1)[0].trim().toLowerCase();
  if (normalized && MIME_EXTENSIONS[normalized]) return normalized;
  const extension = imageExtension(image);
  const entry = Object.entries(MIME_EXTENSIONS).find(([, value]) => value === extension);
  if (!entry) throw new Error('画像形式を判定できません。');
  return entry[0];
}

export function persistDownloadedDogEarImage(
  bytes: Uint8Array,
  mimeType: string,
  dogEarId: string,
): string {
  const extension = imageExtension({ uri: `download.${mimeType.split('/')[1] ?? ''}`, mimeType });
  const target = new File(
    imageDirectory(),
    `${safeId(dogEarId)}-${Date.now()}.${extension}`,
  );
  target.create({ overwrite: true, intermediates: true });
  target.write(bytes);
  return target.uri;
}

/** ユーザーが選んだ原本には触れず、アプリ自身が管理するコピーだけを削除する。 */
export function removeManagedDogEarImage(uri?: string): void {
  if (!uri) return;
  const directory = imageDirectory();
  const prefix = directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
  if (!uri.startsWith(prefix)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
