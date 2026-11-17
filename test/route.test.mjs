// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Álvaro Ritter — Safety Engenharia
// Creation and project direction: Álvaro Ritter. Engineering assistance: AI-assisted development tools.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inScope,runTelegramOwner} from '../.generated/dist/telegram-route-owner.mjs';
import {registerClassifier,routeHook,requireRouteSelection,validateRunEntrySelection,checkSelected} from '../.generated/dist/lab-route-owner.mjs';
process.env.OPENCLAW_LAB_ROUTE_OWNER='6778';
const cfg={plugins:{entries:{'lab-router-6778':{enabled:true}}}};
function fixture(){
 const ctx={SessionKey:'agent:main:telegram:default:direct:1111111111',Provider:'telegram',OriginatingChannel:'telegram',AccountId:'default',ChatType:'direct',SenderId:'1111111111'};
 const entry={}; const run={agentId:'main',thinkLevel:'medium'};
 const turn={queued:{run},session:{current:()=>entry},operation:{abortSignal:new AbortController().signal}};
 return {turn,sessionCtx:ctx,recorder:{resolveMessage:async()=>({content:'pedido',idempotencyKey:'native:1',provenance:{kind:'external_user'}})},assertCurrent(){},getConfig:()=>cfg,entry};
}
test('scope exact and neighbouring conversations unchanged',async()=>{
 for(const [field,value] of [['AccountId','marketing'],['SenderId','4'],['ChatType','group'],['SessionKey','agent:main:main'],['Provider','webchat'],['OriginatingChannel','webchat']]){
  const f=fixture();f.sessionCtx[field]=value;assert.equal(inScope(f.turn,f.sessionCtx),false);
  assert.equal(await runTelegramOwner(f,()=>17),17);
 }
 for(const mutate of [f=>f.turn.queued.run.agentId='dev',f=>f.turn.queued.originatingThreadId=1,f=>f.turn.queued.run.inputProvenance={kind:'internal_system'},f=>f.turn.queued.run.scheduledAutomation={}]){
  const f=fixture();mutate(f);assert.equal(await runTelegramOwner(f,()=>19),19);
 }
});
test('same native recorder, per-turn effort and selection; no persistent pins',async()=>{
 const release=registerClassifier(async()=>'{"kind":"LEVE","risk":"low","confidence":0.99}');
 try {const f=fixture(), original=f.turn.queued.run;
  await runTelegramOwner(f,async()=>{
   assert.equal(f.turn.queued.run.thinkLevel,'low');assert.equal(original.thinkLevel,'medium');
   const result=await requireRouteSelection({},async()=>{const h=routeHook();return {provider:h.providerOverride,modelId:h.modelOverride,fallbacksOverride:h.fallbacksOverride};});
   validateRunEntrySelection(result,false);checkSelected({provider:'openai',model:'gpt-6-luna',thinkLevel:'low'});
   assert.throws(()=>checkSelected({provider:'openai',model:'gpt-6-luna',thinkLevel:'medium'}));
  });
  assert.equal(f.turn.queued.run,original);assert.deepEqual(f.entry,{});
 }finally{release();}
});
test('mandatory route missing service fails before execute',async()=>{let sent=0;await assert.rejects(runTelegramOwner(fixture(),()=>sent++),/missing_lease/);assert.equal(sent,0);});
test('manual pins, thinking, runtime override and guard refusal preserved',async()=>{
 for(const mutate of [f=>f.entry.modelOverride='x',f=>f.entry.thinkingLevel='high',f=>f.turn.queued.run.thinkLevelOverride='high',f=>f.turn.queued.run.modelSelectionLocked=true,f=>f.turn.queued.run.fastModeOverride=true,f=>f.assertCurrent=()=>{throw Error('native-refusal')}]){
  const f=fixture();mutate(f);await assert.rejects(runTelegramOwner(f,()=>assert.fail('dispatched')));
 }
});
test('classification error or revocation never dispatch; restoration on throw',async()=>{
 for(const classify of [async()=>{throw Error('classifier-unavailable')},async()=>'{bad']){
  const release=registerClassifier(classify);try{await assert.rejects(runTelegramOwner(fixture(),()=>assert.fail('sent')));}finally{release();}
 }
 const release=registerClassifier(async()=>'{"kind":"NORMAL","risk":"low","confidence":1}');
 try{const f=fixture(),original=f.turn.queued.run;await assert.rejects(runTelegramOwner(f,()=>{throw Error('runner-refusal')}),/runner-refusal/);assert.equal(f.turn.queued.run,original);}finally{release();}
});
test('native hooks and selected candidate checks are patched once',()=>{
 const runner=fs.readFileSync(new URL('../.generated/dist/agent-runner-run-BjYtW0ag.mjs',import.meta.url),'utf8');
 assert.equal(runner.split('execution = await runTelegramOwner({').length-1,1);
 assert.equal(runner.split('telegramCheckSelected({provider, model, thinkLevel: candidateThinkLevel, runId: turn.opts?.runId});').length-1,1);
 assert.match(runner,/assertCurrent: createReplySourceReadGuard\(turn.operation, turn.queued.operatorAuthority\?\.assertCurrent\).assertReadCurrent/);
});

const {gateIngress,gateQueue,gateNativeCommand,hasAttachments}=await import('../.generated/dist/telegram-route-owner.mjs');
test('pre-owner command and queue gates refuse native, inline, explicit steering before dispatch',()=>{
 const f=fixture(),ctx=f.sessionCtx;
 for(const commandText of ['/model x','/think high','/fast on','/steer x','/new','/queue followup','pedido /model: x','/model@Safety_bot x']){
  for(const field of ['RawBody','CommandBody','BodyForAgent','commandText','agentText'])
   assert.throws(()=>gateIngress('main',{...ctx,[field]:commandText}),/pre_owner_command/);
 }
 assert.doesNotThrow(()=>gateIngress('main',{...ctx,RawBody:'pedido normal'}));
 assert.throws(()=>gateIngress('main',ctx,{queueModeOverride:'steer'}),/queue_override/);
 for(const mode of ['steer','interrupt','collect','steer-backlog','unknown',undefined]) assert.throws(()=>gateQueue('main',ctx,{},mode),/queue_mode/);
 assert.doesNotThrow(()=>gateQueue('main',ctx,{},'followup'));
 for(const field of ['AccountId','SessionKey','SenderId','ChatType','Provider','OriginatingChannel']) {
  const other={...ctx,[field]:'other',RawBody:'/model x'};
  assert.doesNotThrow(()=>gateIngress('main',other));assert.doesNotThrow(()=>gateQueue('main',other,{},'steer'));
 }
 for(const opts of [{isHeartbeat:true},{scheduledAutomation:{}},{internalEventExecution:{}}]) assert.doesNotThrow(()=>gateIngress('main',{...ctx,RawBody:'/model x'},opts));
 assert.doesNotThrow(()=>gateIngress('dev',{...ctx,RawBody:'/model x'}));
 assert.throws(()=>gateIngress('main',ctx,{operatorAuthority:{assertCurrent(){throw Error('native-owner-refusal')}}}),/native-owner-refusal/);
});
test('native Telegram builtins and plugins refused after auth and before route mutation',()=>{
 const auth={inspectedRoute:{route:{agentId:'main'}},targetSessionKey:fixture().sessionCtx.SessionKey,isGroup:false,threadSpec:{},senderId:'1111111111',chatId:1111111111};
 assert.throws(()=>gateNativeCommand({accountId:'default'},auth),/native_command_refused/);
 for(const change of [{senderId:'1'},{chatId:1},{isGroup:true},{threadSpec:{id:2}},{targetSessionKey:'other'},{inspectedRoute:{route:{agentId:'dev'}}}]) assert.doesNotThrow(()=>gateNativeCommand({accountId:'default'},{...auth,...change}));
 assert.doesNotThrow(()=>gateNativeCommand({accountId:'other'},auth));
});
test('normalized media, audio transcription, stickers and image options escalate without loading files',async()=>{
 for(const patch of [{media:[{kind:'audio',contentType:'audio/ogg'}]},{media:[{kind:'file',path:'media://inbound/id'}]},{media:[{kind:'image'}]},{media:[{kind:'video'}]},{Sticker:{}},{StickerMediaIncluded:true},{MediaUnderstanding:[{kind:'audio.transcription'}]},{MediaUnderstandingDecisions:[{}]}]){
  const f=fixture();Object.assign(f.sessionCtx,patch);assert.equal(hasAttachments(f.sessionCtx,f.turn.queued),true);
  let seen=false;
  const release=registerClassifier(async req=>{seen=req.attachments;return '{"kind":"LEVE","risk":"low","confidence":1}'});
  try {await runTelegramOwner(f,()=>{assert.equal(f.turn.queued.run.thinkLevel,'high');const h=routeHook();assert.equal(h.modelOverride,'gpt-6-sol')});assert.equal(seen,true);}finally{release();}
 }
 assert.equal(hasAttachments(fixture().sessionCtx,fixture().turn.queued),false);
});
test('early gates precede explicit steer, slash fast path, interrupt, injection and native route mutation',()=>{
 const get=fs.readFileSync(new URL('../.generated/dist/get-reply-BnwmFitU.mjs',import.meta.url),'utf8');
 const start=get.indexOf('async function resolveReplyFromConfig('),gate=get.indexOf('gateIngress(',start);
 assert.ok(gate>start && gate<get.indexOf('const explicitSteerTargetSessionKey =',start));
 assert.ok(gate<get.indexOf('const nativeSlashCommandFastReply =',start));
 const admission=get.indexOf('async function prepareReplyRunAdmission('),q=get.indexOf('gateQueue(',admission);
 assert.ok(q>admission && q<get.indexOf('preemptAndDrainEmbeddedHeartbeatRun(',admission));
 assert.ok(q<get.indexOf('if (activeRunQueueMode === "interrupt"',admission));
 const native=fs.readFileSync(new URL('../.generated/dist/bot-native-command-dispatch-B32RuGgZ.mjs',import.meta.url),'utf8');
 const prep=native.indexOf('async function prepareTelegramCommandDispatch('),ng=native.indexOf('gateNativeCommand(',prep);
 assert.ok(ng>native.indexOf('if (!auth) return null;',prep));assert.ok(ng<native.indexOf('await touchTelegramConversationRoute(',prep));
});

const {withSubscriptionBoundary,validatePreparedSubscription,oauthProfile}=await import('../.generated/dist/lab-route-owner.mjs');
const {scopedQueueMode}=await import('../.generated/dist/telegram-route-owner.mjs');
function subscriptionFixture(){
 const input={provider:'openai',sessionAuthProfileId:oauthProfile,sessionAuthProfileSource:'user',harnessId:'codex',authProfileStore:{profiles:{[oauthProfile]:{type:'oauth'}}}};
 const plan={providerForAuth:'openai',harnessAuthProvider:'openai',forwardedAuthProfileId:oauthProfile,forwardedAuthProfileSource:'user',selectedAuthMode:'oauth',modelRoute:{authRequirement:'subscription'},forwardedAuthProfileCandidateIds:[oauthProfile]};
 return {input,prepared:{plan,attempts:[{kind:'profile',profileId:oauthProfile,plan}]}};
}
test('native prepared plans refuse API, direct fallback, profile drift, non-Codex and missing policy',async()=>{
 const mutations=[f=>f.prepared.plan.modelRoute.authRequirement='api-key',f=>f.input.authProfileStore.profiles[oauthProfile].type='api_key',f=>f.input.harnessId='openclaw',f=>f.input.sessionAuthProfileId='other',f=>f.prepared.plan.forwardedAuthProfileId='other',f=>f.prepared.plan.forwardedAuthProfileCandidateIds.push('other'),f=>f.prepared.attempts.push({kind:'direct',plan:f.prepared.plan}),f=>f.prepared.attempts[0].profileId='other',f=>delete f.prepared.plan.modelRoute,f=>f.prepared.attempts=[]];
 for(const mutate of mutations){const f=subscriptionFixture();mutate(f);await assert.rejects(withSubscriptionBoundary(()=>{},async()=>validatePreparedSubscription(f.input,f.prepared)),/subscription_/);}
 const f=subscriptionFixture();await withSubscriptionBoundary(()=>{},async()=>assert.equal(validatePreparedSubscription(f.input,f.prepared),f.prepared));
 await assert.rejects(withSubscriptionBoundary(()=>{throw Error('revoked')},async()=>validatePreparedSubscription(f.input,f.prepared)),/revoked/);
 assert.equal(validatePreparedSubscription(f.input,f.prepared),f.prepared); // adjacent work unmodified
});
test('classifier uses supported llm isolated API, explicit OAuth and reasoning; no reviewer',async()=>{
 const source=fs.readFileSync(new URL('../.generated/plugin/index.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/subagent\.complete|revisor|requiredAuthMode/);
 const {default:plugin}=await import('../.generated/plugin/index.mjs');let service,request;
 plugin.register({registerService:s=>service=s,on(){},logger:{info(){}},runtime:{llm:{async complete(req){request=req;return {text:'{"kind":"LEVE","risk":"low","confidence":1}'}}}}});
 service.start();try{const f=fixture(),original=f.turn.queued.run;await runTelegramOwner(f,async()=>{assert.equal(f.turn.queued.run.authProfileId,oauthProfile);assert.equal(f.turn.queued.run.authProfileIdSource,'user');assert.equal(f.turn.queued.run.provider,'openai');});assert.equal(f.turn.queued.run,original);
 assert.equal(request.agentId,'main');assert.equal(request.reasoning,'low');assert.deepEqual(request.execution,{mode:'isolated-agent-runtime',authProfileId:oauthProfile,timeoutMs:45000});assert.equal(request.messages[0].role,'user');}finally{service.stop();}
 const auth=fs.readFileSync(new URL('../.generated/dist/prepare-auth-CZ3ZGxd8.mjs',import.meta.url),'utf8');assert.equal(auth.split('return validatePreparedSubscription(input, prepareAgentRuntimeAuthOriginal(input));').length-1,1);
});
test('only implicit native steer default becomes scoped followup; explicit queue and adjacent preserved',()=>{
 const f=fixture(),params={cfg:{messages:{queue:null}},sessionEntry:{}};
 assert.equal(scopedQueueMode('main',f.sessionCtx,{},params),'followup');
 for(const mutate of [p=>p.inlineMode='steer',p=>p.sessionEntry.queueMode='collect',p=>p.cfg.messages.queue={mode:'interrupt'},p=>p.cfg.messages.queue={byChannel:{telegram:'steer'}}]){const p=structuredClone(params);mutate(p);assert.equal(scopedQueueMode('main',f.sessionCtx,{},p),p.inlineMode);}
 assert.equal(scopedQueueMode('dev',f.sessionCtx,{},params),undefined);
});
test('native candidate runtime and CLI bypass refuse before dispatch',async()=>{
 const {validateSubscriptionRuntime}=await import('../.generated/dist/lab-route-owner.mjs');
 for(const args of [['openclaw',false,oauthProfile],['codex',true,oauthProfile],['codex',false,'other']]) await assert.rejects(withSubscriptionBoundary(()=>{},async()=>validateSubscriptionRuntime(...args)),/runtime_refused/);
 await withSubscriptionBoundary(()=>{},async()=>validateSubscriptionRuntime('codex',false,oauthProfile));
 const src=fs.readFileSync(new URL('../.generated/dist/agent-runner-run-BjYtW0ag.mjs',import.meta.url),'utf8');assert.equal(src.split('validateSubscriptionRuntime(candidateAgentRuntime, runtime.useCliExecution, candidateRun.authProfileId);').length-1,1);
});

const {runIndependentAdministration,routePromptHook}=await import('../.generated/dist/lab-route-owner.mjs');
async function routedFixture(body) {
 const release=registerClassifier(async()=>'{"kind":"LEVE","risk":"low","confidence":1}');
 try {const f=fixture();return await runTelegramOwner(f,()=>body(f));}finally{release();}
}
async function selectParent() {
 const selection=await requireRouteSelection({},async()=>{const h=routeHook();return {provider:h.providerOverride,modelId:h.modelOverride,fallbacksOverride:h.fallbacksOverride}});
 checkSelected({provider:selection.provider,model:selection.modelId,thinkLevel:'low',runId:'fixture-parent'});
 return selection;
}
test('native administration has independent selection and native auth policy; parent guards restore',async()=>{
 await routedFixture(async()=>{
  await selectParent();
  await runIndependentAdministration(async()=>{
   assert.equal(routeHook(),undefined);assert.equal(routePromptHook(),undefined);
   const nativeProbe=await requireRouteSelection({},async()=>({provider:'openai',modelId:'gpt-6.1-sol'}));assert.equal(nativeProbe.modelId,'gpt-6.1-sol');
   const nativePrepared={nativePolicy:'unmodified'};assert.equal(validatePreparedSubscription({provider:'probe-native-policy'},nativePrepared),nativePrepared);
  });
  assert.equal(routeHook().modelOverride,'gpt-6-luna');
  await assert.rejects(requireRouteSelection({},async()=>({provider:'openai',modelId:'other',fallbacksOverride:[]})),/own_hook_absent_or_failed/);
  const invalid=subscriptionFixture();invalid.prepared.plan.selectedAuthMode='api-key';assert.throws(()=>validatePreparedSubscription(invalid.input,invalid.prepared),/subscription_plan_refused/);
 });
});
test('native administration error cannot retire or replace parent route authority',async()=>{
 await routedFixture(async()=>{await selectParent();await assert.rejects(runIndependentAdministration(async()=>{assert.equal(routeHook(),undefined);throw Error('native-admin-refusal')}),/native-admin-refusal/);assert.equal(routeHook().modelOverride,'gpt-6-luna');});
});
const adminSource=fs.readFileSync(new URL('../.generated/dist/system-agent-Cl6ELMrR.mjs',import.meta.url),'utf8');
const adminStart=adminSource.indexOf('"openclaw.chat": '),adminEnd=adminSource.lastIndexOf('\n};\n//#endregion');
const adminArrow=adminSource.slice(adminStart+'"openclaw.chat": '.length,adminEnd).trim();
function nativeAdminHandler({valid=true,revoked=false}={}) {
 const facts={validated:0,asserted:0};
 const deps={runIndependentAdministration,readGatewayRequestMutationAuthority:()=>{assert.equal(routeHook().modelOverride,'gpt-6-luna');return {assertCurrent(){facts.asserted++;if(revoked)throw Error('native-caller-revoked')}}},sanitizeSystemAgentChatParams:x=>x,assertValidParams:()=>{facts.validated++;return valid},validateSystemAgentChatParams:()=>true,getSystemAgentChatInputError:()=>null};
 return {handler:Function(...Object.keys(deps),'return ('+adminArrow+');')(...Object.values(deps)),facts};
}
test('actual native admin RPC wrapper still validates parameters and rejects revoked callers',async()=>{
 await routedFixture(async()=>{
  await selectParent();const bad=nativeAdminHandler({valid:false});await bad.handler({params:{},respond(){}});assert.equal(bad.facts.validated,1);assert.equal(bad.facts.asserted,0);
  const revoked=nativeAdminHandler({revoked:true});await assert.rejects(revoked.handler({params:{},respond(){}}),/native-caller-revoked/);assert.equal(revoked.facts.asserted,1);assert.equal(routeHook().modelOverride,'gpt-6-luna');
 });
});
test('administration RPC original native authorization and approval body is byte-for-byte preserved',()=>{
 const restored=adminSource.replace('import { runIndependentAdministration } from "./lab-route-owner.mjs";\n','').replace('const pending = await runSystemAgentGatewayTask(() => runIndependentAdministration(async () => {','const pending = await runSystemAgentGatewayTask(async () => {').replace('\n\t\t}));\n\t\tif (pending) {','\n\t\t});\n\t\tif (pending) {');
 assert.equal(restored,fs.readFileSync(new URL('../fixtures/upstream/system-agent-Cl6ELMrR.mjs',import.meta.url),'utf8'));
});
test('model-visible current-turn metadata reports router choice without copying input or claiming unverified auth',async()=>{
 await routedFixture(async()=>{
  await selectParent();const before=routePromptHook().prependSystemContext;assert.match(before,/openai\/gpt-6-luna/);assert.match(before,/"effort":"low"/);assert.doesNotMatch(before,/pedido|router-owner@/);assert.match(before,/"executorSubscriptionPrepared":false/);
  const auth=subscriptionFixture();validatePreparedSubscription(auth.input,auth.prepared);
  assert.match(routePromptHook().prependSystemContext,/"executorSubscriptionPrepared":true/);
  await runIndependentAdministration(async()=>assert.equal(routePromptHook(),undefined));
 });assert.equal(routePromptHook(),undefined);
});
test('prompt metadata rebuild emits one scoped receipt and preserves the selected model',async()=>{
 const release=registerClassifier(async()=>'{"kind":"LEVE","risk":"low","confidence":1}');
 try {const f=fixture(),receipts=[];f.emit=r=>receipts.push(r);await runTelegramOwner(f,async()=>{await selectParent();assert.deepEqual(routePromptHook(),routePromptHook());assert.equal(routeHook().modelOverride,'gpt-6-luna')});assert.equal(receipts.filter(r=>r.phase==='context-provided').length,1);}finally{release();}
});

test('actual native admin task isolates only after native caller checks and scheduling',async()=>{
 await routedFixture(async()=>{
  await selectParent();let authorized=false,scheduled=false,entered=false;
  const deps={runIndependentAdministration,
   readGatewayRequestMutationAuthority:()=>({assertCurrent(){assert.equal(routeHook().modelOverride,'gpt-6-luna');authorized=true}}),
   sanitizeSystemAgentChatParams:x=>x,assertValidParams:()=>true,validateSystemAgentChatParams:()=>true,getSystemAgentChatInputError:()=>null,
   createSystemAgentTranscriptStore:()=>({assertCurrent(){}}),createSystemAgentGreetingCache:()=>({assertCurrent(){}}),
   runSystemAgentGatewayTask:async run=>{assert.ok(authorized);assert.equal(routeHook().modelOverride,'gpt-6-luna');scheduled=true;return run()}
  };
  const handler=Function(...Object.keys(deps),'return ('+adminArrow+');')(...Object.values(deps));
  await assert.rejects(handler({params:{sessionId:'fixture-admin'},respond(){},context:{systemAgentSessions:{get(){assert.ok(authorized&&scheduled);assert.equal(routeHook(),undefined);entered=true;throw Error('inside-native-independent-admin')}}}}),/inside-native-independent-admin/);
  assert.ok(entered);assert.equal(routeHook().modelOverride,'gpt-6-luna');
 });
});

const {recoverNativePolicyPreparation}=await import('../.generated/dist/lab-route-owner.mjs');
const harnessSource=fs.readFileSync(new URL('../.generated/dist/selection-CecZuDT-.mjs',import.meta.url),'utf8');
const harnessStart=harnessSource.indexOf('async function runAgentHarnessOperation('),harnessEnd=harnessSource.indexOf('\nfunction withoutInternalHarnessAuthority',harnessStart);
function nativeHarnessFixture() {
 const facts={prepared:0,authorized:0,warnings:0};
 const deps={recoverNativePolicyPreparation,prepareActiveNodeContext:async()=>facts.prepared++,readRunOperatorAuthority:()=>({profileId:'fixture-owner'}),resolveAdmittedRunActiveAssertion:()=>()=>facts.authorized++,getActiveDiagnosticTraceContext:()=>undefined,createDiagnosticTraceContext:()=>({}),createChildDiagnosticTraceContext:()=>({}),freezeDiagnosticTraceContext:x=>x,isBuiltInOpenClawAgentHarness:()=>false,runWithDiagnosticTraceContext:async(_trace,run)=>run(),log:{warn(){facts.warnings++}},formatErrorMessage:e=>e.message};
 const factory=Object.getPrototypeOf(async function(){}).constructor;
 return {facts,async run(params,execute,harness={id:'codex',label:'Codex'}){const invoke=await new factory(...Object.keys(deps),harnessSource.slice(harnessStart,harnessEnd)+'\nreturn runAgentHarnessOperation;')(...Object.values(deps));return invoke(harness,params,execute)}};
}
const policyFailure=()=>Error('Codex session execution policy changed; prepare the operation again.');
const parentParams=()=>({agentId:'main',sessionKey:'agent:main:telegram:default:direct:1111111111',runId:'fixture-parent',provider:'openai',modelId:'gpt-6-luna'});
test('native pre-inference policy refusal re-prepares once through all original native checks',async()=>{
 await routedFixture(async()=>{await selectParent();const native=nativeHarnessFixture();let attempts=0;assert.equal(await native.run(parentParams(),async()=>{if(++attempts===1)throw policyFailure();return 42}),42);assert.equal(attempts,2);assert.equal(native.facts.prepared,2);assert.equal(native.facts.authorized,2);});
});
test('persistent native policy refusal never retries more than once',async()=>{
 await routedFixture(async()=>{await selectParent();const native=nativeHarnessFixture();let attempts=0;await assert.rejects(native.run(parentParams(),async()=>{attempts++;throw policyFailure()}),/execution policy changed/);assert.equal(attempts,2);});
});
test('policy failure after prompt construction cannot replay inference or tools',async()=>{
 await routedFixture(async()=>{await selectParent();const native=nativeHarnessFixture();let attempts=0;await assert.rejects(native.run(parentParams(),async()=>{attempts++;routePromptHook();throw policyFailure()}),/execution policy changed/);assert.equal(attempts,1);});
});
test('non-policy failure is never converted into another inference attempt',async()=>{
 await routedFixture(async()=>{await selectParent();const native=nativeHarnessFixture();let attempts=0;await assert.rejects(native.run(parentParams(),async()=>{attempts++;throw Error('different-auth-or-provider-failure')}),/different-auth/);assert.equal(attempts,1);});
});
test('aborted native source prevents the preparation retry',async()=>{
 await routedFixture(async()=>{await selectParent();const native=nativeHarnessFixture(),abort=new AbortController();let attempts=0;await assert.rejects(native.run({...parentParams(),abortSignal:abort.signal},async()=>{attempts++;abort.abort(Error('native-cancelled'));throw policyFailure()}),/native-cancelled/);assert.equal(attempts,1);});
});
test('revoked native owner prevents a preparation retry',async()=>{
 const f=fixture();let revoked=false;f.assertCurrent=()=>{if(revoked)throw Error('native-owner-revoked')};const release=registerClassifier(async()=>'{"kind":"LEVE","risk":"low","confidence":1}');
 try{await runTelegramOwner(f,async()=>{await selectParent();const native=nativeHarnessFixture();let attempts=0;await assert.rejects(native.run(parentParams(),async()=>{attempts++;revoked=true;throw policyFailure()}),/native-owner-revoked/);assert.equal(attempts,1);});}finally{release();}
});
test('other run, model, native harness, administration or finalization cannot borrow recovery',async()=>{
 await routedFixture(async()=>{await selectParent();
  for(const patch of [{runId:'other'},{modelId:'other'},{sessionKey:'other'},{operation:'settled-tool-finalization'}]){const native=nativeHarnessFixture();let attempts=0;await assert.rejects(native.run({...parentParams(),...patch},async()=>{attempts++;throw policyFailure()}),/execution policy changed/);assert.equal(attempts,1);}
  const native=nativeHarnessFixture();let attempts=0;await assert.rejects(native.run(parentParams(),async()=>{attempts++;throw policyFailure()},{id:'openclaw',label:'OpenClaw'}),/execution policy changed/);assert.equal(attempts,1);
  await runIndependentAdministration(async()=>{let child=0;await assert.rejects(native.run(parentParams(),async()=>{child++;throw policyFailure()}),/execution policy changed/);assert.equal(child,1);});
 });
});
test('native harness original admission and authorization body remains byte identical',()=>{
 const restored=harnessSource.replace('import { recoverNativePolicyPreparation } from "./lab-route-owner.mjs";\n','').replace('async function runAgentHarnessOperation(harness, params, execute) {\n return recoverNativePolicyPreparation(harness,params,()=>runAgentHarnessOperationOriginal(harness,params,execute));\n}\nasync function runAgentHarnessOperationOriginal(harness, params, execute) {','async function runAgentHarnessOperation(harness, params, execute) {');
 assert.equal(restored,fs.readFileSync(new URL('../fixtures/upstream/selection-CecZuDT-.mjs',import.meta.url),'utf8'));
});


const {parseClassification: costPolicyDecision}=await import('../.generated/dist/lab-route-owner.mjs');
const classified=(kind='NORMAL',risk='low',confidence=0.99)=>JSON.stringify({kind,risk,confidence});
test('cost policy normal low-risk requests choose Sol low, never Astra medium',()=>{
 assert.deepEqual(costPolicyDecision(classified(),false),{model:'gpt-6-sol',effort:'low'});
 assert.deepEqual(costPolicyDecision(classified('LEVE'),false),{model:'gpt-6-luna',effort:'low'});
});
test('cost policy ordinary reviews use Sol high without escalating to Astra',()=>{
 for(const risk of ['low','medium'])assert.deepEqual(costPolicyDecision(classified('REVISAO',risk),false),{model:'gpt-6-sol',effort:'high'});
});
test('cost policy medium risk and media cannot be demoted to low or force Astra alone',()=>{
 for(const kind of ['LEVE','NORMAL']){
  assert.deepEqual(costPolicyDecision(classified(kind,'medium'),false),{model:'gpt-6-sol',effort:'high'});
  assert.deepEqual(costPolicyDecision(classified(kind),true),{model:'gpt-6-sol',effort:'high'});
 }
});
test('cost policy exceptional floors outrank cheap labels and media floor',()=>{
 for(const data of [classified('COMPLEXO'),classified('DESCONHECIDO'),classified('LEVE','high'),classified('NORMAL','unknown'),classified('NORMAL','low',0.84)])
  for(const media of [false,true])assert.deepEqual(costPolicyDecision(data,media),{model:'gpt-6-astra',effort:'high'});
 for(const kind of ['LEVE','NORMAL','REVISAO','COMPLEXO','DESCONHECIDO'])
  for(const risk of ['low','medium','high','unknown'])assert.notEqual(costPolicyDecision(classified(kind,risk),false).effort,'medium');
});
test('queued admitted owner applies new Sol roles once and restores original run',async()=>{
 for(const [kind,effort] of [['NORMAL','low'],['REVISAO','high']]){
  let classifiedCount=0;const release=registerClassifier(async()=>{classifiedCount++;return classified(kind)});
  try {const f=fixture(),original=f.turn.queued.run,receipts=[];f.emit=r=>receipts.push(r);
   await runTelegramOwner(f,async()=>{
    const selected=await requireRouteSelection({},async()=>{const h=routeHook();return {provider:h.providerOverride,modelId:h.modelOverride,fallbacksOverride:h.fallbacksOverride}});
    validateRunEntrySelection(selected,false);assert.equal(selected.modelId,'gpt-6-sol');assert.equal(f.turn.queued.run.thinkLevel,effort);
    checkSelected({provider:'openai',model:'gpt-6-sol',thinkLevel:effort,runId:'cost-policy-queued'});
   });
   assert.equal(classifiedCount,1);assert.equal(f.turn.queued.run,original);assert.deepEqual(f.entry,{});
   assert.equal(receipts.filter(r=>r.phase==='classified').length,1);
   assert.equal(receipts.find(r=>r.phase==='candidate-selected').effort,effort);
  }finally{release();}
 }
});
