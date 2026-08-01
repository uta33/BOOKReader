import assert from 'node:assert/strict';
import {
  normalizeGoogleCoverUrl,
  searchGoogleBookCovers,
  shapeGoogleDynamicCover,
  shapeGoogleBookCovers,
} from '../src/bookCovers.ts';

const payload = {
  items: [
    {
      id: 'exact-volume',
      volumeInfo: {
        title: '思考の整理学',
        authors: ['外山 滋比古'],
        industryIdentifiers: [
          { type: 'ISBN_13', identifier: '978-4-480-02047-5' },
        ],
        imageLinks: {
          thumbnail: 'http://books.google.com/books/content?id=exact&img=1',
          large: 'https://books.google.com/books/content?id=exact&img=1&zoom=4',
        },
      },
    },
    {
      id: 'related-volume',
      volumeInfo: {
        title: '別の版',
        industryIdentifiers: [{ type: 'ISBN_13', identifier: '9784000000000' }],
        imageLinks: {
          thumbnail: 'https://books.googleusercontent.com/books/content?id=related',
        },
      },
    },
    {
      id: 'unsafe-image',
      volumeInfo: {
        title: '不正画像',
        imageLinks: { thumbnail: 'https://evil.example/cover.jpg' },
      },
    },
    { id: 'no-image', volumeInfo: { title: '書影なし' } },
  ],
};

const covers = shapeGoogleBookCovers(
  payload,
  '9784480020475',
  'google-books-isbn',
);
assert.equal(covers.length, 2);
assert.equal(covers[0].exactIsbn, true);
assert.equal(covers[0].author, '外山 滋比古');
assert.equal(
  covers[0].url,
  'https://books.google.com/books/content?id=exact&img=1&zoom=4',
  '利用可能な最大画像を選ぶ',
);
assert.equal(covers[1].exactIsbn, false);
assert.equal(
  normalizeGoogleCoverUrl('http://books.google.com/books/content?id=x'),
  'https://books.google.com/books/content?id=x',
);
assert.equal(normalizeGoogleCoverUrl('https://books.google.com.evil.test/a.jpg'), undefined);
assert.equal(normalizeGoogleCoverUrl('file:///tmp/a.jpg'), undefined);

const dynamicBody = `var _GBSBookInfo = {"ISBN:9784480020475":{
  "bib_key":"ISBN:9784480020475",
  "thumbnail_url":"https://books.google.com/books/content?id=exact&img=1"
}};`;
const dynamicCover = shapeGoogleDynamicCover(
  dynamicBody,
  '9784480020475',
  '思考の整理学',
  '外山滋比古',
);
assert.equal(dynamicCover.length, 1);
assert.equal(dynamicCover[0]?.exactIsbn, true);
assert.equal(dynamicCover[0]?.title, '思考の整理学');
assert.equal(
  shapeGoogleDynamicCover(dynamicBody, '9784101010137').length,
  0,
  '応答のISBNが違う場合は採用しない',
);
assert.equal(
  shapeGoogleDynamicCover('not javascript', '9784480020475').length,
  0,
  '壊れた応答は空候補へ倒す',
);

const originalFetch = globalThis.fetch;
let requestedUrl = '';
try {
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    if (requestedUrl.includes('jscmd=viewapi')) {
      return new Response('var _GBSBookInfo = {};', {
        status: 200,
        headers: { 'Content-Type': 'text/javascript' },
      });
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const searched = await searchGoogleBookCovers(
    { GOOGLE_BOOKS_API_KEY: 'server-only-key' } as never,
    { isbn: '9784480020475' },
  );
  assert.equal(searched[0]?.exactIsbn, true);
  assert.match(requestedUrl, /q=isbn%3A9784480020475/);
  assert.match(requestedUrl, /key=server-only-key/);
  assert.equal(
    searched.some((candidate) => candidate.url.includes('server-only-key')),
    false,
    'APIキーを候補URLへ混ぜない',
  );
} finally {
  globalThis.fetch = originalFetch;
}

const requestedTitleUrls: string[] = [];
try {
  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedTitleUrls.push(url);
    const titlePayload = url.includes('intitle%3A')
      ? { items: [] }
      : {
        items: [
          {
            volumeInfo: {
              title: '思考の整理学 増補版',
              imageLinks: { thumbnail: 'https://books.google.com/books/content?id=relevant' },
            },
          },
          {
            volumeInfo: {
              title: '思考法の入門',
              imageLinks: { thumbnail: 'https://books.google.com/books/content?id=unrelated' },
            },
          },
        ],
      };
    return new Response(JSON.stringify(titlePayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const titleResults = await searchGoogleBookCovers(
    { GOOGLE_BOOKS_API_KEY: 'server-only-key' } as never,
    { title: '思考の整理学', author: '外山滋比古' },
  );
  assert.equal(requestedTitleUrls.length, 2, '厳密検索と一般検索を併用する');
  assert.equal(
    requestedTitleUrls.some((url) => url.includes('intitle%3A')),
    true,
  );
  assert.equal(
    requestedTitleUrls.some((url) =>
      url.includes('%E6%80%9D%E8%80%83%E3%81%AE%E6%95%B4%E7%90%86%E5%AD%A6')
      && !url.includes('intitle%3A')
    ),
    true,
    '日本語で厳密指定が空でも一般検索へフォールバックできる',
  );
  assert.deepEqual(
    titleResults.map((candidate) => candidate.title),
    ['思考の整理学 増補版'],
    '一般検索の無関係な書影を除く',
  );
} finally {
  globalThis.fetch = originalFetch;
}

try {
  globalThis.fetch = async () => new Response(dynamicBody, {
    status: 200,
    headers: { 'Content-Type': 'text/javascript' },
  });
  const withoutApiKey = await searchGoogleBookCovers(
    {} as never,
    { isbn: '9784480020475', title: '思考の整理学' },
  );
  assert.equal(withoutApiKey[0]?.exactIsbn, true, 'Dynamic LinksはAPIキーなしでも使える');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('book-covers.test.mts: passed');
