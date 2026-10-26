import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Store } from './store.ts';

export type TokenScope = 'api' | 'dispatcher' | 'agent' | 'gateway' | 'docs';
export interface IssuedToken { id: string; token: string; scope: TokenScope; runId?: string; generation?: number; expiresAt: number }

export function issueToken(store: Store, scope: TokenScope, options: { runId?: string; generation?: number; ttlMs?: number } = {}): IssuedToken {
  const token = randomBytes(32).toString('base64url');
  const id = randomUUID();
  const expiresAt = Date.now() + (options.ttlMs ?? 60 * 60 * 1000);
  store.db.prepare('INSERT INTO auth_tokens(id,token_hash,scope,run_id,generation,expires_at,revoked_at) VALUES(?,?,?,?,?,?,NULL)').run(id, hashToken(token), scope, options.runId ?? null, options.generation ?? null, expiresAt);
  return { id, token, scope, runId: options.runId, generation: options.generation, expiresAt };
}
export function hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
export function authenticateBearer(store: Store, authorization: string | undefined, required: TokenScope, context: { runId?: string; generation?: number } = {}) {
  if (!authorization?.startsWith('Bearer ')) throw new Error('Authentication failed');
  const supplied = authorization.slice(7);
  if (!supplied || supplied.length > 256) throw new Error('Authentication failed');
  const row = store.db.prepare('SELECT * FROM auth_tokens WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?').get(hashToken(supplied), Date.now()) as Record<string, unknown> | undefined;
  if (!row || row.scope !== required || (row.run_id && row.run_id !== context.runId) || (row.generation !== null && row.generation !== context.generation)) throw new Error('Authentication failed');
  return row;
}
export function revokeToken(store: Store, id: string) { store.db.prepare('UPDATE auth_tokens SET revoked_at=? WHERE id=?').run(Date.now(), id); }
export function constantTimeEqual(a: string, b: string) { const x=Buffer.from(a), y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); }
