import assert from 'node:assert/strict';
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  type JSONWebKeySet,
} from 'jose';
import {
  type OAuthFlow,
  requireUsableOAuthFlow,
  verifyGoogleIdTokenWithJwks,
} from '../src/oauth.ts';

const { privateKey, publicKey } = await generateKeyPair('RS256');
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = 'test-key';
publicJwk.alg = 'RS256';
const jwks: JSONWebKeySet = { keys: [publicJwk] };
const now = new Date('2026-07-28T00:00:00Z');
const nowSeconds = Math.floor(now.getTime() / 1000);

async function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({ nonce: 'nonce-1', email: 'reader@example.com', ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject('google-sub-1')
    .setIssuer('https://accounts.google.com')
    .setAudience('bookreader-client')
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + 300)
    .sign(privateKey);
}

const valid = await verifyGoogleIdTokenWithJwks(
  await token(),
  jwks,
  'bookreader-client',
  'nonce-1',
  now,
);
assert.equal(valid.sub, 'google-sub-1');

const validToken = await token();
await assert.rejects(() =>
  verifyGoogleIdTokenWithJwks(
    validToken,
    jwks,
    'wrong-audience',
    'nonce-1',
    now,
  ),
);

await assert.rejects(async () =>
  verifyGoogleIdTokenWithJwks(
    await token({ nonce: 'wrong' }),
    jwks,
    'bookreader-client',
    'nonce-1',
    now,
  ),
);

const expired = await new SignJWT({ nonce: 'nonce-1' })
  .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
  .setSubject('google-sub-1')
  .setIssuer('https://accounts.google.com')
  .setAudience('bookreader-client')
  .setIssuedAt(nowSeconds - 600)
  .setExpirationTime(nowSeconds - 1)
  .sign(privateKey);
await assert.rejects(() =>
  verifyGoogleIdTokenWithJwks(expired, jwks, 'bookreader-client', 'nonce-1', now),
);

const wrongIssuer = await new SignJWT({ nonce: 'nonce-1' })
  .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
  .setSubject('google-sub-1')
  .setIssuer('https://example.com')
  .setAudience('bookreader-client')
  .setIssuedAt(nowSeconds)
  .setExpirationTime(nowSeconds + 300)
  .sign(privateKey);
await assert.rejects(() =>
  verifyGoogleIdTokenWithJwks(wrongIssuer, jwks, 'bookreader-client', 'nonce-1', now),
);

const pendingFlow: OAuthFlow = {
  id: 'flow-1',
  user_id: 'user-1',
  nonce: 'nonce-1',
  pkce_verifier: 'verifier',
  status: 'pending',
  google_sub: null,
  google_email: null,
  conflict_user_id: null,
  expires_at: now.getTime() + 60_000,
  consumed_at: null,
};
assert.equal(requireUsableOAuthFlow(pendingFlow, 'user-1', now.getTime()), pendingFlow);
assert.throws(
  () => requireUsableOAuthFlow(pendingFlow, 'user-2', now.getTime()),
  (error: unknown) => (error as { status?: number }).status === 403,
);
assert.throws(
  () =>
    requireUsableOAuthFlow(
      { ...pendingFlow, expires_at: now.getTime() - 1 },
      'user-1',
      now.getTime(),
    ),
  (error: unknown) => (error as { status?: number }).status === 400,
);
assert.throws(
  () =>
    requireUsableOAuthFlow(
      { ...pendingFlow, status: 'consumed', consumed_at: now.getTime() },
      'user-1',
      now.getTime(),
    ),
  (error: unknown) => (error as { status?: number }).status === 409,
);
assert.throws(
  () => requireUsableOAuthFlow(null, 'user-1', now.getTime()),
  (error: unknown) => (error as { status?: number }).status === 403,
);

console.log('oauth.test.mts: passed');
