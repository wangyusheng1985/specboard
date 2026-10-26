import { randomUUID } from 'node:crypto';
import { decrypt, encrypt } from './security.ts';
import type { Pool } from 'pg';

export interface RelayConfig {
 id: string; name: string; url: string; token: string;
 protocol: 'openai-chat' | 'openai-responses'; model: string;
 priority: number; retries: number; enabled: boolean;
 allowInsecureHttp: boolean; timeoutMs: number;
}
export type PublicRelay = Omit<RelayConfig,'token'> & {hasToken:boolean};
export function validateRelay(input: RelayConfig, allowedHosts: string[]) {
 if (!input.name?.trim() || !input.model?.trim() || !input.token) throw new Error('名称、模型和 Token 必填');
 if (!['openai-chat','openai-responses'].includes(input.protocol)) throw new Error('不支持的协议');
 if (!Number.isInteger(input.priority)||input.priority<0||input.priority>100) throw new Error('优先级必须为 0 至 100');
 if (!Number.isInteger(input.retries)||input.retries<0||input.retries>10) throw new Error('重试次数必须为 0 至 10');
 if (!Number.isInteger(input.timeoutMs)||input.timeoutMs<1000||input.timeoutMs>600000) throw new Error('超时必须为 1000 至 600000 毫秒');
 if (typeof input.enabled!=='boolean'||typeof input.allowInsecureHttp!=='boolean') throw new Error('启用和 HTTP 设置必须为布尔值');
 const url=new URL(input.url);
 if(url.username||url.password||url.search||url.hash)throw new Error('API 地址不能包含凭据或查询参数');
 if(url.protocol!=='https:' && !(url.protocol==='http:'&&input.allowInsecureHttp))throw new Error('HTTP 需要显式启用');
 if(!allowedHosts.includes(url.host))throw new Error('中转主机不在部署允许列表中');
 const hostname=url.hostname.replace(/^\[|\]$/g,'');
 if(['169.254.169.254','metadata.google.internal','0.0.0.0','::'].includes(hostname))throw new Error('禁止访问元数据或未指定地址');
 return input;
}
export function publicRelay(value:RelayConfig):PublicRelay {
 const {token,...rest}=value;return {...rest,hasToken:Boolean(token)};
}
export class RelayRepository {
 constructor(private pool:Pool,private key:string,private hosts:string[]){}
 async migrate(){await this.pool.query(`CREATE TABLE IF NOT EXISTS llm_relays(
 id TEXT PRIMARY KEY, config JSONB NOT NULL, encrypted_token TEXT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);}
 async list():Promise<PublicRelay[]>{const rows=await this.pool.query('SELECT id,config FROM llm_relays ORDER BY (config->>\'priority\')::integer DESC,id');return rows.rows.map(row=>({...row.config,id:row.id,hasToken:true}));}
 async candidates():Promise<RelayConfig[]>{const rows=await this.pool.query("SELECT * FROM llm_relays WHERE config->>'enabled'='true' ORDER BY (config->>'priority')::integer DESC,id");return rows.rows.map(row=>({...row.config,id:row.id,token:decrypt(row.encrypted_token,this.key)}));}
 async save(input:Omit<RelayConfig,'id'> & {id?:string}){
  const id=input.id||randomUUID();let token=input.token;
  if(input.id&&!token){const old=await this.pool.query('SELECT encrypted_token FROM llm_relays WHERE id=$1',[id]);if(!old.rows[0])throw new Error('中转不存在');token=decrypt(old.rows[0].encrypted_token,this.key);}
  const config=validateRelay({...input,id,token},this.hosts);const {token:secret,...safe}=config;
  await this.pool.query('INSERT INTO llm_relays(id,config,encrypted_token) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET config=excluded.config,encrypted_token=excluded.encrypted_token,updated_at=now()',[id,safe,encrypt(secret,this.key)]);
  return publicRelay(config);
 }
 async remove(id:string){const result=await this.pool.query('DELETE FROM llm_relays WHERE id=$1',[id]);return Boolean(result.rowCount);}
}
