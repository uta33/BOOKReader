import type { Book, DigitalLink, DogEar } from '../types/book';

export type SyncEntity = 'book' | 'dogEar' | 'digitalLink';

export interface SyncChange {
  entity: SyncEntity;
  id: string;
  bookId?: string;
  data: Record<string, unknown>;
  updatedAt: number;
  deletedAt?: number;
  originDeviceId: string;
  rev?: number;
}

export interface SyncMetadata {
  cursor: number;
  syncedAt: Record<string, number>;
}

export function syncKey(entity: SyncEntity, id: string): string {
  return `${entity}:${id}`;
}

export function flattenLibrary(books: Book[], deviceId: string): SyncChange[] {
  const changes: SyncChange[] = [];
  for (const book of books) {
    const updatedAt = Math.max(
      book.updatedAt ?? Math.max(1, book.createdAt),
      book.deletedAt ?? 0,
    );
    changes.push({
      entity: 'book',
      id: book.id,
      data: {
        title: book.title,
        totalPages: book.totalPages,
        lastSentenceIdx: book.lastSentenceIdx,
        createdAt: book.createdAt,
        kind: book.kind,
        purposes: book.purposes,
        isbn: book.isbn,
        author: book.author,
        publisher: book.publisher,
        pubdate: book.pubdate,
        coverUrl: book.coverUrl,
        bookstore: book.bookstore,
        summary: book.summary,
        recap: book.recap,
        recapCreatedAt: book.recapCreatedAt,
        rating: book.rating,
        startedAt: book.startedAt,
        finishedAt: book.finishedAt,
      },
      updatedAt,
      deletedAt: book.deletedAt,
      originDeviceId: book.originDeviceId ?? deviceId,
    });
    for (const dogEar of book.dogEars) {
      changes.push({
        entity: 'dogEar',
        id: dogEar.id,
        bookId: book.id,
        data: {
          page: dogEar.page,
          line: dogEar.line,
          quote: dogEar.quote,
          comment: dogEar.comment,
          createdAt: dogEar.createdAt,
          reviewLevel: dogEar.reviewLevel,
          lastReviewedAt: dogEar.lastReviewedAt,
          nextReviewAt: dogEar.nextReviewAt,
          photoAttachmentId: dogEar.photoAttachmentId,
        },
        updatedAt: Math.max(
          dogEar.updatedAt ?? Math.max(1, dogEar.createdAt),
          dogEar.deletedAt ?? 0,
        ),
        deletedAt: dogEar.deletedAt,
        originDeviceId: dogEar.originDeviceId ?? deviceId,
      });
    }
    for (const link of book.links) {
      changes.push({
        entity: 'digitalLink',
        id: link.id,
        bookId: book.id,
        data: {
          label: link.label,
          url: link.url,
          kind: link.kind,
          createdAt: link.createdAt,
        },
        updatedAt: Math.max(
          link.updatedAt ?? Math.max(1, link.createdAt),
          link.deletedAt ?? 0,
        ),
        deletedAt: link.deletedAt,
        originDeviceId: link.originDeviceId ?? deviceId,
      });
    }
  }
  return changes;
}

export function dirtyChanges(
  books: Book[],
  metadata: SyncMetadata,
  deviceId: string,
): SyncChange[] {
  return flattenLibrary(books, deviceId).filter(
    (change) => change.updatedAt > (metadata.syncedAt[syncKey(change.entity, change.id)] ?? 0),
  );
}

export function compareChanges(left: SyncChange, right: SyncChange): number {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt - right.updatedAt;
  const deleted = Number(left.deletedAt !== undefined) - Number(right.deletedAt !== undefined);
  if (deleted) return deleted;
  return left.originDeviceId.localeCompare(right.originDeviceId);
}

export function applyServerChanges(
  books: Book[],
  incoming: SyncChange[],
  sentVersions: ReadonlyMap<string, number> = new Map(),
): Book[] {
  let result = books;
  const ordered = [...incoming].sort((left, right) => {
    if (left.entity === right.entity) return (left.rev ?? 0) - (right.rev ?? 0);
    if (left.entity === 'book') return -1;
    if (right.entity === 'book') return 1;
    return 0;
  });
  for (const change of ordered) {
    result =
      change.entity === 'book'
        ? applyBook(result, change, sentVersions)
        : change.entity === 'dogEar'
          ? applyDogEar(result, change, sentVersions)
          : applyLink(result, change, sentVersions);
  }
  return result;
}

export function applyFullSnapshot(
  books: Book[],
  snapshot: SyncChange[],
  metadata: SyncMetadata,
  deviceId: string,
  sentVersions: ReadonlyMap<string, number> = new Map(),
): Book[] {
  const serverKeys = new Set(snapshot.map((change) => syncKey(change.entity, change.id)));
  const dirty = new Set(
    dirtyChanges(books, metadata, deviceId).map((change) => syncKey(change.entity, change.id)),
  );
  const retained = books
    .filter(
      (book) =>
        serverKeys.has(syncKey('book', book.id)) ||
        dirty.has(syncKey('book', book.id)) ||
        !(syncKey('book', book.id) in metadata.syncedAt),
    )
    .map((book) => ({
      ...book,
      dogEars: book.dogEars.filter((item) => {
        const key = syncKey('dogEar', item.id);
        return serverKeys.has(key) || dirty.has(key) || !(key in metadata.syncedAt);
      }),
      links: book.links.filter((item) => {
        const key = syncKey('digitalLink', item.id);
        return serverKeys.has(key) || dirty.has(key) || !(key in metadata.syncedAt);
      }),
    }));
  return applyServerChanges(retained, snapshot, sentVersions);
}

export function replaceWithServerSnapshot(
  localBooks: Book[],
  snapshot: SyncChange[],
  preserveLocalContent: boolean,
): Book[] {
  const serverBooks = applyServerChanges([], snapshot);
  if (!preserveLocalContent) return serverBooks;

  const localContent = localBooks.filter((book) => book.kind === 'content');
  const localPhotos = new Map(
    localBooks.flatMap((book) =>
      book.dogEars
        .filter((dogEar) => dogEar.photoUri)
        .map((dogEar) => [dogEar.id, dogEar] as const),
    ),
  );
  const usedLocalIds = new Set<string>();
  return serverBooks.map((serverBook) => {
    const local = findLocalContent(serverBook, localContent, usedLocalIds);
    if (local) usedLocalIds.add(local.id);
    return {
      ...serverBook,
      uri: local?.uri ?? serverBook.uri,
      sentences: local?.sentences ?? serverBook.sentences,
      cachedSentenceIds: local?.cachedSentenceIds ?? serverBook.cachedSentenceIds,
      dogEars: serverBook.dogEars.map((dogEar) => {
        const localDogEar = localPhotos.get(dogEar.id);
        const matches = localDogEar?.photoAttachmentId === dogEar.photoAttachmentId;
        return {
          ...dogEar,
          photoUri: matches ? localDogEar?.photoUri : undefined,
          photoAttachmentSyncedAt: matches
            ? localDogEar?.photoAttachmentSyncedAt
            : undefined,
        };
      }),
    };
  });
}

function applyBook(
  books: Book[],
  remote: SyncChange,
  sentVersions: ReadonlyMap<string, number>,
): Book[] {
  const index = books.findIndex((book) => book.id === remote.id);
  if (index < 0) {
    const created = remoteBook(remote);
    return [created, ...books];
  }
  const local = books[index];
  const localChange = bookVersion(local);
  const acknowledged =
    sentVersions.get(syncKey('book', local.id)) === localChange.updatedAt &&
    remote.originDeviceId === localChange.originDeviceId;
  const remoteWins = acknowledged || compareChanges(remote, localChange) >= 0;
  const lastSentenceIdx = Math.max(
    local.lastSentenceIdx,
    numberField(remote.data.lastSentenceIdx, 0),
  );
  const merged = remoteWins
    ? {
        ...remoteBook(remote),
        uri: local.uri,
        sentences: local.sentences,
        cachedSentenceIds: local.cachedSentenceIds,
        dogEars: local.dogEars,
        links: local.links,
        lastSentenceIdx,
      }
    : { ...local, lastSentenceIdx };
  return replaceAt(books, index, merged as Book);
}

function remoteBook(remote: SyncChange): Book {
  const data = remote.data;
  return {
    id: remote.id,
    title: stringField(data.title, '同期した本'),
    uri: '',
    totalPages: numberField(data.totalPages, 0),
    sentences: [],
    lastSentenceIdx: numberField(data.lastSentenceIdx, 0),
    cachedSentenceIds: [],
    createdAt: numberField(data.createdAt, remote.updatedAt),
    kind: data.kind === 'paper' ? 'paper' : 'content',
    dogEars: [],
    links: [],
    purposes: Array.isArray(data.purposes) ? (data.purposes as Book['purposes']) : [],
    isbn: optionalString(data.isbn),
    author: optionalString(data.author),
    publisher: optionalString(data.publisher),
    pubdate: optionalString(data.pubdate),
    coverUrl: optionalString(data.coverUrl),
    bookstore: optionalString(data.bookstore),
    summary: optionalString(data.summary),
    recap: optionalString(data.recap),
    recapCreatedAt: optionalNumber(data.recapCreatedAt),
    rating: optionalNumber(data.rating),
    startedAt: optionalNumber(data.startedAt),
    finishedAt: optionalNumber(data.finishedAt),
    updatedAt: remote.updatedAt,
    deletedAt: remote.deletedAt,
    originDeviceId: remote.originDeviceId,
  };
}

function applyDogEar(
  books: Book[],
  remote: SyncChange,
  sentVersions: ReadonlyMap<string, number>,
): Book[] {
  if (!remote.bookId) return books;
  return books.map((book) => {
    if (book.id !== remote.bookId) return book;
    const index = book.dogEars.findIndex((item) => item.id === remote.id);
    if (index < 0) return { ...book, dogEars: [...book.dogEars, remoteDogEar(remote)] };
    const local = book.dogEars[index];
    const localVersion = childVersion('dogEar', local);
    const acknowledged =
      sentVersions.get(syncKey('dogEar', local.id)) === localVersion.updatedAt &&
      remote.originDeviceId === localVersion.originDeviceId;
    if (!acknowledged && compareChanges(remote, localVersion) < 0) return book;
    const canonical = remoteDogEar(remote);
    const samePhoto = canonical.photoAttachmentId === local.photoAttachmentId;
    return {
      ...book,
      dogEars: replaceAt(book.dogEars, index, {
        ...canonical,
        photoUri: samePhoto ? local.photoUri : undefined,
        photoAttachmentSyncedAt: samePhoto ? local.photoAttachmentSyncedAt : undefined,
      }),
    };
  });
}

function applyLink(
  books: Book[],
  remote: SyncChange,
  sentVersions: ReadonlyMap<string, number>,
): Book[] {
  if (!remote.bookId) return books;
  return books.map((book) => {
    if (book.id !== remote.bookId) return book;
    const index = book.links.findIndex((item) => item.id === remote.id);
    if (index < 0) return { ...book, links: [...book.links, remoteLink(remote)] };
    const local = book.links[index];
    const localVersion = childVersion('digitalLink', local);
    const acknowledged =
      sentVersions.get(syncKey('digitalLink', local.id)) === localVersion.updatedAt &&
      remote.originDeviceId === localVersion.originDeviceId;
    if (!acknowledged && compareChanges(remote, localVersion) < 0) return book;
    return {
      ...book,
      links: replaceAt(book.links, index, remoteLink(remote)),
    };
  });
}

function remoteDogEar(remote: SyncChange): DogEar {
  return {
    id: remote.id,
    page: numberField(remote.data.page, 0),
    line: optionalNumber(remote.data.line),
    quote: stringField(remote.data.quote, ''),
    comment: optionalString(remote.data.comment),
    createdAt: numberField(remote.data.createdAt, remote.updatedAt),
    reviewLevel: optionalNumber(remote.data.reviewLevel),
    lastReviewedAt: optionalNumber(remote.data.lastReviewedAt),
    nextReviewAt: optionalNumber(remote.data.nextReviewAt),
    photoAttachmentId: optionalString(remote.data.photoAttachmentId),
    updatedAt: remote.updatedAt,
    deletedAt: remote.deletedAt,
    originDeviceId: remote.originDeviceId,
  };
}

function remoteLink(remote: SyncChange): DigitalLink {
  const kind = remote.data.kind;
  return {
    id: remote.id,
    label: stringField(remote.data.label, ''),
    url: stringField(remote.data.url, ''),
    kind:
      kind === 'notebooklm' || kind === 'claude' || kind === 'gdocs' ? kind : 'other',
    createdAt: numberField(remote.data.createdAt, remote.updatedAt),
    updatedAt: remote.updatedAt,
    deletedAt: remote.deletedAt,
    originDeviceId: remote.originDeviceId,
  };
}

function bookVersion(book: Book): SyncChange {
  return {
    entity: 'book',
    id: book.id,
    data: {},
    updatedAt: Math.max(
      book.updatedAt ?? Math.max(1, book.createdAt),
      book.deletedAt ?? 0,
    ),
    deletedAt: book.deletedAt,
    originDeviceId: book.originDeviceId ?? 'legacy',
  };
}

function childVersion(
  entity: 'dogEar' | 'digitalLink',
  child: DogEar | DigitalLink,
): SyncChange {
  return {
    entity,
    id: child.id,
    data: {},
    updatedAt: Math.max(
      child.updatedAt ?? Math.max(1, child.createdAt),
      child.deletedAt ?? 0,
    ),
    deletedAt: child.deletedAt,
    originDeviceId: child.originDeviceId ?? 'legacy',
  };
}

function findLocalContent(
  serverBook: Book,
  localContent: Book[],
  usedLocalIds: Set<string>,
): Book | undefined {
  if (serverBook.kind !== 'content') return undefined;
  const available = localContent.filter((book) => !usedLocalIds.has(book.id));
  const exact = available.find(
    (book) =>
      book.id === serverBook.id &&
      (book.isbn === serverBook.isbn ||
        (book.title === serverBook.title && book.createdAt === serverBook.createdAt)),
  );
  if (exact) return exact;
  if (serverBook.isbn) {
    const isbn = available.find((book) => book.isbn === serverBook.isbn);
    if (isbn) return isbn;
  }
  return available.find(
    (book) => book.title === serverBook.title && book.createdAt === serverBook.createdAt,
  );
}

function replaceAt<T>(values: T[], index: number, value: T): T[] {
  return values.map((item, itemIndex) => (itemIndex === index ? value : item));
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function stringField(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function numberField(value: unknown, fallback: number): number {
  return optionalNumber(value) ?? fallback;
}
