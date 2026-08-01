export const MAX_BOOK_COVER_BYTES = 5 * 1024 * 1024;

const ALLOWED_HOSTS = new Set([
  'cover.openbd.jp',
  'covers.openlibrary.org',
  'books.google.com',
  'books.googleusercontent.com',
]);

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function isSupportedBookCoverUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function bookCoverExtension(contentType: string | null): string | undefined {
  const mimeType = contentType?.split(';', 1)[0].trim().toLowerCase() ?? '';
  return MIME_EXTENSIONS[mimeType];
}

export function exceedsBookCoverLimit(bytes: number): boolean {
  return Number.isFinite(bytes) && bytes > MAX_BOOK_COVER_BYTES;
}
