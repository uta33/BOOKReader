import type { PurposeId } from '../constants/purposes';

export interface Sentence {
  id: string;
  text: string;
  pageNumber: number;
}

/** 'paper' = 紙の本（READING NOTE 本来の対象）, 'content' = 取り込んだPDF/TXT/AI要約 */
export type BookKind = 'paper' | 'content';

/** ドッグイヤー抜き書き — 折ったページの P（ページ）/ L（行）/ 引用。 */
export interface DogEar {
  id: string;
  /** P — 1始まり。0 は未指定。 */
  page: number;
  /** L — 1始まり。行を控えなかったときは undefined。 */
  line?: number;
  /** 書き写した本文。必須。 */
  quote: string;
  /** なぜ折ったか。 */
  comment?: string;
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number;
  originDeviceId?: string;
  /** 図・グラフ・写真の端末内URI。同期ペイロードには含めない。 */
  photoUri?: string;
  /** R2上の非公開画像ID。端末間同期の対象。 */
  photoAttachmentId?: string;
  /** この端末で画像の送受信が完了した時刻。同期ペイロードには含めない。 */
  photoAttachmentSyncedAt?: number;
  /** 復習で「覚えた」を選んだ段階。未復習は0相当。 */
  reviewLevel?: number;
  /** 最後に復習した時刻。 */
  lastReviewedAt?: number;
  /** 次に「今日のドッグイヤー」へ出す時刻。未設定は今すぐ対象。 */
  nextReviewAt?: number;
}

export type LinkKind = 'notebooklm' | 'claude' | 'gdocs' | 'other';

/** デジタルリンク — その本についてのAI対話・ドキュメントへの外部リンク。 */
export interface DigitalLink {
  id: string;
  label: string;
  url: string;
  kind: LinkKind;
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number;
  originDeviceId?: string;
}

export interface Book {
  // --- 既存（形・意味とも不変） ---
  id: string;
  title: string;
  /** 紙の本は ''。 */
  uri: string;
  /** 紙の本では任意入力のページ数。未入力は 0。 */
  totalPages: number;
  /** 紙の本は []。 */
  sentences: Sentence[];
  lastSentenceIdx: number;
  cachedSentenceIds: string[];
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number;
  originDeviceId?: string;

  // --- READING NOTE（配列は必須。正規化で必ず埋まる） ---
  kind: BookKind;
  dogEars: DogEar[];
  links: DigitalLink[];
  purposes: PurposeId[];

  // --- 書誌（JANコード照会で埋まる） ---
  /** 正規化済み ISBN-13。重複判定のキー。 */
  isbn?: string;
  author?: string;
  publisher?: string;
  pubdate?: string;
  /** 書影の公開URL。クラウド同期ではこちらだけを共有する。 */
  coverUrl?: string;
  /** 端末へ取り込んだ書影URI。同期ペイロードには含めない。 */
  coverLocalUri?: string;

  /** 出会った書店（目的「書店と出会う」の実績）。 */
  bookstore?: string;
  /** まとめ（AI要約 or 手入力）。 */
  summary?: string;
  /** ふりかえり（自分の言葉）。 */
  recap?: string;
  recapCreatedAt?: number;
  /** 1〜5。未評価は undefined。 */
  rating?: number;
  startedAt?: number;
  /** 読了時刻。これが入った本だけが100冊にカウントされる。 */
  finishedAt?: number;
}
