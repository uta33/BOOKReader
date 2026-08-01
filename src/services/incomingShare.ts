export interface SharePayloadLike {
  value: string;
  shareType: 'text' | 'url' | 'audio' | 'image' | 'video' | 'file';
  mimeType?: string;
}

export interface ResolvedSharePayloadLike extends SharePayloadLike {
  contentUri: string | null;
  contentType: 'text' | 'audio' | 'image' | 'video' | 'file' | 'website' | null;
  contentMimeType: string | null;
  originalName: string | null;
  contentSize: number | null;
}

export interface IncomingShareDraft {
  quote: string;
  url?: string;
  linkLabel?: string;
  image?: {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
    size?: number | null;
  };
}

const URL_PATTERN = /https?:\/\/[^\s<>]+/i;

export function normalizeIncomingShare(
  payloads: readonly SharePayloadLike[],
  resolved: readonly ResolvedSharePayloadLike[],
): IncomingShareDraft | null {
  const image = resolved.find(
    (item) => item.contentType === 'image' && typeof item.contentUri === 'string',
  );
  if (image?.contentUri) {
    return {
      quote: '',
      image: {
        uri: image.contentUri,
        fileName: image.originalName,
        mimeType: image.contentMimeType ?? image.mimeType,
        size: image.contentSize,
      },
    };
  }
  const rawImage = payloads.find((item) => item.shareType === 'image');
  if (rawImage?.value) {
    return {
      quote: '',
      image: { uri: rawImage.value, mimeType: rawImage.mimeType },
    };
  }

  const textPayload = payloads.find(
    (item) => item.shareType === 'text' || item.shareType === 'url',
  );
  const value = textPayload?.value.trim();
  if (!value) return null;
  const matched = value.match(URL_PATTERN)?.[0];
  const url = matched ? trimUrlPunctuation(matched) : undefined;
  const quote = url ? value.replace(matched!, '').replace(/\s+/g, ' ').trim() : value;
  return {
    quote,
    url,
    linkLabel: url ? linkLabel(url) : undefined,
  };
}

function trimUrlPunctuation(value: string): string {
  return value.replace(/[),.、。）」』】]+$/u, '');
}

function linkLabel(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '') || '共有リンク';
  } catch {
    return '共有リンク';
  }
}
