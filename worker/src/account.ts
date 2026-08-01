import { randomToken, sha256 } from './crypto';
import { ApiError } from './errors';
import { deleteUserStatements, replaceWithAnonymous } from './auth';
import type { AuthUser, Env } from './types';
import { deleteUserAttachmentObjects } from './attachments';

export async function signOut(request: Request, env: Env, user: AuthUser) {
  const linked = await env.DB.prepare(
    'SELECT 1 AS linked FROM google_identities WHERE user_id = ?',
  )
    .bind(user.id)
    .first<{ linked: number }>();
  if (!linked) throw new ApiError(409, 'Only Google-linked accounts can sign out');
  return replaceWithAnonymous(request, env, user.id);
}

export async function deleteAccount(env: Env, user: AuthUser) {
  await deleteUserAttachmentObjects(env, user.id);
  await env.DB.batch(deleteUserStatements(env, user.id));
  return { deleted: true as const };
}

export async function createDeletionTicket(env: Env, user: AuthUser) {
  const ticket = randomToken();
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000;
  await env.DB.prepare(
    `INSERT INTO deletion_tickets (ticket_hash, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(await sha256(ticket), user.id, expiresAt, now)
    .run();
  return { ticket, expiresAt };
}

export async function deleteWithTicket(env: Env, ticket: unknown): Promise<void> {
  if (typeof ticket !== 'string' || ticket.length < 43 || ticket.length > 128) {
    throw new ApiError(400, 'Deletion ticket is invalid');
  }
  const row = await env.DB.prepare(
    `SELECT user_id FROM deletion_tickets
     WHERE ticket_hash = ? AND consumed_at IS NULL AND expires_at > ?`,
  )
    .bind(await sha256(ticket), Date.now())
    .first<{ user_id: string }>();
  if (!row) throw new ApiError(400, 'Deletion ticket is invalid or expired');
  await deleteUserAttachmentObjects(env, row.user_id);
  await env.DB.batch(deleteUserStatements(env, row.user_id));
}

export function deletionPage(message?: string): Response {
  const notice = message
    ? `<p role="status">${escapeHtml(message)}</p>`
    : '<p>READING NOTEアプリのアカウント画面で発行した削除用コードを入力してください。</p>';
  return new Response(
    `<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>READING NOTE アカウント削除</title>
<body style="max-width:42rem;margin:2rem auto;padding:1rem;font-family:system-ui;line-height:1.7">
<h1>READING NOTE アカウント削除</h1>
${notice}
<p><a href="/account/delete/google/start">Googleで本人確認して削除する</a></p>
<hr>
<form method="post" action="/account/delete">
<label>削除用コード<br><input name="ticket" required autocomplete="off" style="width:100%;padding:.7rem"></label>
<p><button type="submit" style="padding:.7rem 1rem">アカウントとクラウドデータを削除</button></p>
</form>
<p>削除すると、クラウド上の本、抜き書き、画像、リンク、認証セッションを元に戻せません。端末内データはアプリ内の削除操作で消去してください。</p>
<p><a href="/privacy">プライバシーポリシー</a></p>
</body></html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
      },
    },
  );
}

export function privacyPage(contactEmail?: string): Response {
  const contact = contactEmail?.trim()
    ? `<a href="mailto:${escapeHtml(contactEmail.trim())}">${escapeHtml(contactEmail.trim())}</a>`
    : '公開前の設定中です。アプリのサポート欄からお問い合わせください。';
  return htmlResponse(
    `<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>READING NOTE プライバシーポリシー</title>
<body style="max-width:48rem;margin:2rem auto;padding:1rem;font-family:system-ui;line-height:1.75">
<h1>READING NOTE プライバシーポリシー</h1>
<p>最終更新日: 2026年8月1日</p>
<h2>取り扱うデータ</h2>
<p>匿名ユーザーID、Google連携時のGoogle固有IDとメールアドレス、本の書誌・読書ノート・抜き書き・添付画像・リンク・評価・読了情報、API利用件数、同期revision、匿名発行制御用の不可逆化したIPハッシュを取り扱います。</p>
<p>端末へ取り込んだPDF/TXT/Markdown本文、端末内ファイルURI、音声キャッシュはクラウド同期しません。抜き書きへ利用者が添付した画像だけを、復元のため暗号化通信で非公開保存します。</p>
<h2>外部サービス</h2>
<p>AI要約・クイズにはAnthropic、読み上げ・文字認識にはGoogle Cloud、認証にはGoogle OAuth、クラウド保存にはCloudflareを使用し、機能に必要な範囲で入力データを送信します。</p>
<h2>保持と削除</h2>
<p>同期の論理削除記録は90日保持します。アカウント削除時は稼働中データベースのアカウント、読書記録、添付画像、認証セッションを物理削除します。災害復旧履歴のコピーは保持期間終了後に失効します。</p>
<p>ウェブから削除した後、端末に記録が残っている場合は、新しい匿名アカウントへ移すか端末からも削除するかをアプリで確認します。自動では再同期しません。</p>
<p><a href="/account/delete">アカウントとクラウドデータを削除する</a></p>
<h2>安全管理</h2>
<p>プロバイダー秘密鍵をアプリへ保存しません。AndroidのセッショントークンはKeystoreで保護し、サーバーにはSHA-256ハッシュだけを保存します。</p>
<h2>問い合わせ先</h2>
<p>${contact}</p>
</body></html>`,
  );
}

export function publicHome(): Response {
  return htmlResponse(
    `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>READING NOTE</title><body style="max-width:42rem;margin:2rem auto;padding:1rem;font-family:system-ui;line-height:1.7"><h1>READING NOTE</h1><p>認証・同期APIです。</p><ul><li><a href="/privacy">プライバシーポリシー</a></li><li><a href="/account/delete">アカウント削除</a></li></ul></body></html>`,
  );
}

function htmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
