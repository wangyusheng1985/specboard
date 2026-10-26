import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type pg from 'pg';
export class ApiError extends Error{constructor(public status:number,public code:string,message:string){super(message);}}
export type Principal={id:string;scope:string;runId?:string;generation?:number};
export const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
export async function mintToken(db:pg.Pool|pg.PoolClient,scope:string,ttlMs:number,runId?:string,generation?:number){
 const token=randomBytes(32).toString('base64url'),id=randomUUID();
 await db.query('INSERT INTO auth_tokens(id,token_hash,scope,run_id,generation,expires_at) VALUES($1,$2,$3,$4,$5,$6)',[id,digest(token),scope,runId||null,generation||null,Date.now()+ttlMs]);
 return {id,token,expiresAt:Date.now()+ttlMs};
}
export async function checkToken(db:pg.Pool,authorization:string|undefined,scope:string,runId?:string,generation?:number):Promise<Principal>{
 if(!authorization?.startsWith('Bearer '))throw new ApiError(401,'unauthorized','Bearer Token required');
 const result=await db.query('SELECT * FROM auth_tokens WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>$2',[digest(authorization.slice(7)),Date.now()]);
 const row=result.rows[0];if(!row)throw new ApiError(401,'unauthorized','Token expired or invalid');
 if(row.scope!==scope||(row.run_id&&row.run_id!==runId)||(row.generation!==null&&row.generation!==generation))throw new ApiError(403,'forbidden','Token scope does not permit this operation');
 return {id:row.id,scope:row.scope,runId:row.run_id,generation:row.generation};
}
export async function inTransaction<T>(pool:pg.Pool,fn:(client:pg.PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
export async function idempotent(pool:pg.Pool,principal:string,key:string,body:unknown,statusCode:number,fn:(client:pg.PoolClient)=>Promise<unknown>){
 if(!/^[\w-]{16,128}$/.test(key))throw new ApiError(400,'invalid_idempotency_key','Idempotency-Key must contain 16 to 128 characters');
 const fingerprint=digest(JSON.stringify(body));
 return inTransaction(pool,async client=>{
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[principal+':'+key]);
  const previous=(await client.query('SELECT * FROM runtime_requests WHERE principal=$1 AND key=$2',[principal,key])).rows[0];
  if(previous){if(previous.digest!==fingerprint)throw new ApiError(409,'idempotency_conflict','Key already used with another request');return {status:previous.status_code,result:previous.result};}
  const result=await fn(client);await client.query('INSERT INTO runtime_requests VALUES($1,$2,$3,$4,$5,$6)',[principal,key,fingerprint,JSON.stringify(result),statusCode,Date.now()]);return {status:statusCode,result};
 });
}
