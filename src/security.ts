import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Store } from './store.ts';

export function encrypt(value: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',createHash('sha256').update(key).digest(),iv);
  const data = Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');
}
export function decrypt(value: string, key: string) {
  const data = Buffer.from(value,'base64');
  const cipher = createDecipheriv('aes-256-gcm',createHash('sha256').update(key).digest(),data.subarray(0,12));
  cipher.setAuthTag(data.subarray(12,28));
  return Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString();
}
export function signature(secret: string, method: string, path: string, timestamp: string, nonce: string, id: string, body: string) {
  const digest = createHash('sha256').update(body).digest('hex');
  return createHmac('sha256',secret).update([method,path,timestamp,nonce,id,digest].join('\n')).digest('hex');
}
export function authenticate(secret: string, method: string, path: string, body: string, headers: Record<string,string | string[] | undefined>, now = Date.now(), windowMs = 60000) {
  const get = (key: string) => typeof headers[key] === 'string' ? headers[key] as string : '';
  const timestamp = get('x-timestamp'), nonce = get('x-nonce'), id = get('x-request-id'), supplied = get('x-signature');
  if (!/^\d+$/.test(timestamp) || Math.abs(now - Number(timestamp)) > windowMs || !/^[\w-]{16,128}$/.test(nonce) || !/^[\w-]{16,128}$/.test(id)) throw new Error('Authentication failed');
  const expected = signature(secret,method,path,timestamp,nonce,id,body);
  if (!/^[a-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))) throw new Error('Authentication failed');
  return { id, nonce, digest: createHash('sha256').update([method,path,body].join('\n')).digest('hex') };
}
export function acceptRequest(store: Store, auth: {id:string;nonce:string;digest:string}, action: () => unknown) {
  return store.transaction(() => {
    const previous = store.db.prepare('SELECT * FROM requests WHERE id=?').get(auth.id);
    if (previous) {
      if (previous.digest !== auth.digest) throw new Error('Request ID conflict');
      return JSON.parse(previous.result as string);
    }
    if (store.db.prepare('SELECT id FROM requests WHERE nonce=?').get(auth.nonce)) throw new Error('Replay rejected');
    store.db.prepare('INSERT INTO requests VALUES(?,?,?,?,NULL)').run(auth.id,auth.nonce,auth.digest,Date.now());
    const result = action();
    store.db.prepare('UPDATE requests SET result=? WHERE id=?').run(JSON.stringify(result),auth.id);
    return result;
  });
}
