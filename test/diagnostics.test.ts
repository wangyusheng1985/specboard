import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyFailure,createDiagnostic,redactDiagnosticText,validateDiagnostic} from '../src/diagnostics.ts';
test('diagnostics classify source evidence conservatively',()=>{
 for(const [status,category]of [[401,'model_auth'],[403,'model_auth'],[429,'model_rate_limit'],[504,'model_timeout'],[503,'model_upstream']] as const)assert.equal(classifyFailure({status}),category);
 assert.equal(classifyFailure({code:'ETIMEDOUT'}),'model_timeout');assert.equal(classifyFailure({}),'unknown');
 assert.equal(classifyFailure({category:'artifact_validation'}),'artifact_validation');
 const d=createDiagnostic({step:'session',message:'Incomplete tool result'});assert.equal(d.recoverySafety,'manual_inspection');assert.equal(d.evidenceAvailability,'unavailable');
 assert.equal(createDiagnostic({step:'model',message:'Timeout',safeBoundary:true,details:'request failed',requestId:'request',attemptCount:2}).recoverySafety,'safe_boundary');
});
test('diagnostic storage and copy projection remove credentials before bounding text',()=>{
 const raw='Authorization: Bearer abc\nCookie: session=secret\nPRIVATE-TOKEN: private\nhttps://user:pass@example.test/path?token=abc&api_key=def\n{"apiToken":"xyz"}\npassword=hunter2\nknown-value';
 const text=redactDiagnosticText(raw,['known-value']);for(const secret of ['abc','session=secret','private\n','user:pass','def','xyz','hunter2','known-value'])assert.ok(!text.includes(secret),secret);
 const diagnostic=createDiagnostic({step:'model',message:raw,details:raw},['known-value']);assert.equal(validateDiagnostic(diagnostic).category,'unknown');assert.ok(!JSON.stringify(diagnostic).includes('hunter2'));
 assert.equal(createDiagnostic({step:'tool',message:'x'.repeat(3000),details:'x'.repeat(9000)}).details.length,8000);
 assert.throws(()=>validateDiagnostic({...diagnostic,requestId:{secret:'no'}}));assert.throws(()=>validateDiagnostic({...diagnostic,attemptCount:-1}));assert.throws(()=>validateDiagnostic(null));assert.throws(()=>validateDiagnostic({...diagnostic,step:'bad'}));assert.throws(()=>validateDiagnostic({...diagnostic,message:'x'.repeat(2001)}));
});
