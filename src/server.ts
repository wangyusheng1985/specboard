import { createApp } from './app.ts';
const app=createApp({dataDir:process.env.DATA_DIR||'./data',secret:process.env.API_SECRET||'',encryptionKey:process.env.ENCRYPTION_KEY||'',workspaceRoot:process.env.WORKSPACE_ROOT||'./data/workspaces',sessionDir:process.env.SESSION_DIR||'./data/sessions',agentDir:process.env.PI_AGENT_DIR||'./data/pi',allowedHosts:(process.env.GITLAB_ALLOWED_HOSTS||'gitlab.com').split(',').map(s=>s.trim())});
app.server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Specboard listening'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{void app.close().then(()=>process.exit(0));});
