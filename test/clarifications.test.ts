import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateQuestions,validateAnswers} from '../src/clarifications.ts';
const questions=()=>validateQuestions([{id:'approach',type:'single_choice',prompt:'Choose approach',reason:'Defines architecture',required:true,options:[{id:'a',label:'A'}],recommendedOptionIds:['a']},{id:'features',type:'multiple_choice',prompt:'Features?',reason:'Defines scope',required:false,options:[{id:'b',label:'B'}]},{id:'constraints',type:'text',prompt:'Constraints?',reason:'Defines limits',required:true},{id:'plan',type:'confirmation',prompt:'Approve?',reason:'Needs decision',required:true}]);
test('clarifications validate four question types and explicit answers without preselecting recommendations',()=>{
 const qs=questions();const answers={approach:{text:'Custom architecture'},constraints:{text:'No external services'},plan:{confirmed:false}};
 assert.deepEqual(validateAnswers(qs,answers),answers);assert.deepEqual(validateAnswers(qs,{},'',true),{});
 assert.throws(()=>validateAnswers(qs,{}),/Required/);
 assert.throws(()=>validateAnswers(qs,{...answers,approach:{optionIds:['unknown']}}),/Invalid choice/);
 assert.throws(()=>validateAnswers(qs,{...answers,unknown:{text:'x'}}),/Unknown/);
 assert.throws(()=>validateAnswers(qs,{...answers,constraints:{text:'x'.repeat(10001)}}),/Invalid answer/);
 assert.throws(()=>validateAnswers(qs,{...answers,plan:{}}),/confirmation/);
 assert.throws(()=>validateAnswers(qs,{...answers,features:{optionIds:['b','b']}}),/choice/);
});
test('clarifications reject duplicate IDs, unbounded content and malformed recommendations',()=>{
 const q=questions()[0];assert.throws(()=>validateQuestions([]));assert.throws(()=>validateQuestions([q,q]),/duplicate/);
 assert.throws(()=>validateQuestions([{...q,prompt:'x'.repeat(2001)}]));
 assert.throws(()=>validateQuestions([{...q,options:[{id:'a',label:'A'},{id:'a',label:'Again'}]}]));
 assert.throws(()=>validateQuestions([{...q,recommendedOptionIds:['missing']}]));
 assert.throws(()=>validateQuestions([{...q,type:'text'}]));
 assert.throws(()=>validateQuestions(Array(21).fill(q)));
 assert.throws(()=>validateAnswers(questions(),null));
});
