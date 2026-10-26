export function responsesToChat(body:any,model:string){
 const input=typeof body.input==='string'?[{role:'user',content:body.input}]:body.input||[];
 const messages:any[]=[];if(body.instructions)messages.push({role:'system',content:body.instructions});
 for(const item of input){if(item.type==='function_call')messages.push({role:'assistant',content:null,tool_calls:[{id:item.call_id,type:'function',function:{name:item.name,arguments:item.arguments}}]});else if(item.type==='function_call_output')messages.push({role:'tool',tool_call_id:item.call_id,content:item.output});else messages.push({role:item.role||'user',content:typeof item.content==='string'?item.content:(item.content||[]).map((part:any)=>({type:'text',text:part.text||''}))});}
 return {model,messages,stream:body.stream||false,...(body.max_output_tokens?{max_tokens:body.max_output_tokens}:{}),...(body.tools?.length?{tools:body.tools.map((tool:any)=>({type:'function',function:{name:tool.name,description:tool.description,parameters:tool.parameters}}))}:{})};
}
export function chatToResponses(body:any,model:string){
 const choice=body.choices?.[0],message=choice?.message;if(!message)throw new Error('Malformed chat completion');
 const output:any[]=[];
 if(message.content)output.push({id:'msg_'+body.id,type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:message.content,annotations:[]}]});
 for(const call of message.tool_calls||[])output.push({id:call.id,type:'function_call',call_id:call.id,name:call.function.name,arguments:call.function.arguments,status:'completed'});
 return {id:body.id||'resp_proxy',object:'response',created_at:body.created||Math.floor(Date.now()/1000),model,status:'completed',output,usage:{input_tokens:body.usage?.prompt_tokens||0,output_tokens:body.usage?.completion_tokens||0,total_tokens:body.usage?.total_tokens||0}};
}
export function responseSse(response:any){
 const records:any[]=[{type:'response.created',response:{...response,status:'in_progress',output:[]}}];
 response.output.forEach((item:any,index:number)=>{
  records.push({type:'response.output_item.added',output_index:index,item:{...item,status:'in_progress',...(item.type==='message'?{content:[]}:{arguments:''})}});
  if(item.type==='message'){records.push({type:'response.content_part.added',output_index:index,content_index:0,item_id:item.id,part:{type:'output_text',text:'',annotations:[]}});records.push({type:'response.output_text.delta',output_index:index,content_index:0,item_id:item.id,delta:item.content[0].text});records.push({type:'response.output_text.done',output_index:index,content_index:0,item_id:item.id,text:item.content[0].text});records.push({type:'response.content_part.done',output_index:index,content_index:0,item_id:item.id,part:item.content[0]});}
  else{records.push({type:'response.function_call_arguments.delta',output_index:index,item_id:item.id,delta:item.arguments});records.push({type:'response.function_call_arguments.done',output_index:index,item_id:item.id,arguments:item.arguments});}
  records.push({type:'response.output_item.done',output_index:index,item});
 });
 records.push({type:'response.completed',response});
 return records.map((record,index)=>`event: ${record.type}\ndata: ${JSON.stringify({...record,sequence_number:index})}\n\n`).join('');
}
