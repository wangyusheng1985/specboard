import {createServer} from 'node:http';
import {responseSse} from '../src/protocols.ts';
const server=createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw||'{}');const response={id:'resp_fixture',object:'response',created_at:Math.floor(Date.now()/1000),model:'fixture',status:'completed',output:[{id:'msg_fixture',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'Fixture completed: validation successful.',annotations:[]}]}],usage:{input_tokens:10,output_tokens:8,total_tokens:18}};res.writeHead(200,{'content-type':body.stream?'text/event-stream':'application/json'});res.end(body.stream?responseSse(response):JSON.stringify(response));});
server.listen(3431,'0.0.0.0');
