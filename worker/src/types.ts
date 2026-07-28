export interface Env {
  DB: D1Database;
  JWKS_CACHE: KVNamespace;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_TTS_API_KEY?: string;
  GOOGLE_VISION_API_KEY?: string;
  AUTH_HMAC_SECRET: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  SUMMARY_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  PUBLIC_BASE_URL: string;
  PRIVACY_CONTACT_EMAIL?: string;
}

export interface AuthUser {
  id: string;
  sessionId: string;
}

export type EntityType = 'book' | 'dogEar' | 'digitalLink';

export interface SyncChange {
  entity: EntityType;
  id: string;
  bookId?: string;
  data: Record<string, unknown>;
  updatedAt: number;
  deletedAt?: number;
  originDeviceId: string;
  rev?: number;
}

export interface WorkerVariables {
  user: AuthUser;
}
