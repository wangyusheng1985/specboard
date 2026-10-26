import {createRuntimeApi} from './runtime-api.ts';
const required=(name:string)=>{const value=process.env[name];if(!value||value.length<16)throw new Error(`${name} is required`);return value;};
const runtime=await createRuntimeApi({databaseUrl:required('DATABASE_URL'),secret:required('API_SECRET'),dispatcherToken:required('DISPATCHER_TOKEN'),gatewayUrl:process.env.GATEWAY_URL||'http://llm-gateway:4000',gatewayAdminToken:required('GATEWAY_ADMIN_TOKEN'),encryptionKey:required('ENCRYPTION_KEY')});
await runtime.app.listen({port:Number(process.env.PORT||3000),host:'0.0.0.0'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void runtime.app.close().then(()=>process.exit(0));});
