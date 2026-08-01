export type ImportFileKind = 'pdf' | 'txt' | 'markdown';

const TEXT_CHUNK_SIZE = 800;

export function detectImportFileKind(filename: string): ImportFileKind | null {
  const normalized = filename.trim().toLowerCase();
  if (normalized.endsWith('.pdf')) return 'pdf';
  if (normalized.endsWith('.txt')) return 'txt';
  if (normalized.endsWith('.md') || normalized.endsWith('.markdown')) return 'markdown';
  return null;
}

export function storedExtensionFor(kind: ImportFileKind): string {
  if (kind === 'markdown') return '.md';
  return `.${kind}`;
}

export function titleFromImportFilename(filename: string): string {
  return filename.replace(/\.(pdf|txt|md|markdown)$/i, '');
}

export function chunkImportedText(text: string): { page: number; text: string }[] {
  const pages: { page: number; text: string }[] = [];
  for (let index = 0; index < text.length; index += TEXT_CHUNK_SIZE) {
    pages.push({ page: pages.length + 1, text: text.slice(index, index + TEXT_CHUNK_SIZE) });
  }
  return pages.length > 0 ? pages : [{ page: 1, text }];
}

/** Markdown記号、リンク先URL、コードを除き、読み上げやすい本文へ変換する。 */
export function markdownToReadableText(markdown: string): string {
  let text = markdown
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/^---\s*\n[\s\S]*?\n(?:---|\.\.\.)\s*(?:\n|$)/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, '')
    .replace(/^\s{0,3}\[[^\]]+\]:\s+\S+.*$/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/!\[\[([^\]]+)\]\]/g, (_, target: string) => readableObsidianEmbed(target))
    .replace(/\[\[([^\]]+)\]\]/g, (_, target: string) => readableWikiLink(target))
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/<https?:\/\/[^>]+>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^\s{0,3}>[ \t]?/gm, '')
    .replace(/^\s{0,3}(?:[-+*]|\d+[.)])[ \t]+/gm, '')
    .replace(/^\s*[-*_](?:\s*[-*_]){2,}\s*$/gm, '')
    .replace(/^\s*(?:\|?\s*:?-{3,}:?\s*)+\|?\s*$/gm, '')
    .replace(/^\s*={3,}\s*$/gm, '')
    .replace(/^\s*\|\s?/gm, '')
    .replace(/\s?\|\s*$/gm, '')
    .replace(/\s*\|\s*/g, '、')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/^\s*\[[ xX-]\][ \t]*/gm, '')
    .replace(/\\([\\`*_[\]{}()#+\-.!>])/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");

  text = text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

function readableWikiLink(target: string): string {
  const [destination, alias] = target.split('|');
  return (alias ?? destination).trim();
}

function readableObsidianEmbed(target: string): string {
  const [destination, alias] = target.split('|');
  const trimmedAlias = alias?.trim();
  if (trimmedAlias && !/^\d+(?:x\d+)?$/.test(trimmedAlias)) return trimmedAlias;
  if (/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(destination.trim())) return '';
  return destination.trim();
}
