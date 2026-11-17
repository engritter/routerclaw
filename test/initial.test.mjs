// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Álvaro Ritter — Safety Engenharia
// Creation and project direction: Álvaro Ritter. Engineering assistance: AI-assisted development tools.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runInitialTelegramOwner} from '../.generated/dist/telegram-route-owner.mjs';
import {registerClassifier,routeHook,requireRouteSelection,validateRunEntrySelection,checkSelected} from '../.generated/dist/lab-route-owner.mjs';
process.env.OPENCLAW_LAB_ROUTE_OWNER='6778';
const source=fs.readFileSync(process.env.TELEGRAM6894_INITIAL_SOURCE ?? new URL('../.generated/dist/agent-runner-run-BjYtW0ag.mjs',import.meta.url),'utf8');
const begin=source.indexOf('async function executePreparedReplyAgentRun(input) {');
const end=source.indexOf('\n//#endregion',begin);
const nativeFunction=source.slice(begin,end);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const cfg={plugins:{entries:{'lab-router-6778':{enabled:true}}}};
function harness({duplicate=false,neighbour=false,pin=false,abortAtClassify=false,revokeAtClassify=false,failExecution=false,classification={kind:'LEVE',risk:'low',confidence:1},expectedModel='gpt-6-luna',expectedEffort='low'}={}) {
 const order=[],receipts=[];let calls=0,classifications=0,admitted=false,adopted=false,revoked=false;
 const abort=new AbortController();const entry=pin?{thinkingLevel:'medium'}:{};
 const original={agentId:'main',thinkLevel:'medium',sessionId:'fixture-session',provider:'openai'};
 const recorder={async resolveMessage(){assert.ok(admitted&&adopted);return {content:'synthetic qualification request',idempotencyKey:'fixture-native-input',provenance:{kind:'external_user'}}}};
 const queued={run:original,userTurnTranscriptRecorder:recorder,operatorAuthority:{assertCurrent(){if(revoked)throw Error('native-authority-revoked')}}};
 const operation={abortSignal:abort.signal,sessionId:'fixture-session',setPhase(){},updateSessionId(){}};
 const ctx={SessionKey:'agent:main:telegram:default:direct:1111111111',Provider:neighbour?'webchat':'telegram',OriginatingChannel:neighbour?'webchat':'telegram',AccountId:'default',ChatType:'direct',SenderId:'1111111111'};
 const input={followupRun:queued,replyOperation:operation,sessionCtx:ctx,sessionKey:ctx.SessionKey,getActiveSessionEntry:()=>entry,setActiveSessionEntry(){},typingSignals:{async signalRunStart(){order.push('typing')}},traceAgentPhase:(_phase,fn)=>fn(),admitUserTurn:async r=>{assert.equal(r,recorder);order.push('admit');admitted=true;return duplicate?'duplicate-source':'accepted'},turnAdoptionLifecycle:{async onAdopted(){order.push('adopt');adopted=true}},setRunFollowupTurn(){},returnWithQueuedFollowupDrain:()=>({duplicate:true}),beginBeforeAgentReply:async()=>{},checkpointBeforeAgentReply:async()=>{}};
 const deps={
  readPendingUserTurnTranscriptAdmission:r=>{assert.equal(r,recorder);return {}},
  runSessionCompactionIfNeeded:async o=>o.sessionEntry,
  createFollowupRunner:()=>()=>{},
  getGatewayContextResolver:op=>{assert.equal(op,operation);return ()=>undefined},
  withBeforeAgentReplyObserver:(_observer,run)=>run(),
  runInitialTelegramOwner,
  createReplySourceReadGuard:(op,authority)=>{assert.equal(op,operation);assert.equal(authority,queued.operatorAuthority.assertCurrent);return {assertReadCurrent(){order.push('guard');assert.ok(admitted&&adopted);op.abortSignal.throwIfAborted();authority()}}},
  telegramRuntimeConfig:()=>cfg,
  diagnosticLogger:{info:(name,receipt)=>{assert.equal(name,'telegram-route-6894');receipts.push(receipt)}},
  executeAgentTurn:async p=>{
   calls++;order.push('execute');assert.equal(p.followupRun,queued);assert.equal(p.replyOperation,operation);assert.ok(admitted&&adopted);
   if(neighbour){assert.equal(queued.run,original);assert.equal(routeHook(),undefined)}
   else {
    assert.notEqual(queued.run,original);assert.equal(queued.run.thinkLevel,expectedEffort);
    const selected=await requireRouteSelection({},async()=>{const h=routeHook();return {provider:h.providerOverride,modelId:h.modelOverride,fallbacksOverride:h.fallbacksOverride}});
    validateRunEntrySelection(selected,false);assert.equal(selected.modelId,expectedModel);checkSelected({provider:'openai',model:selected.modelId,thinkLevel:queued.run.thinkLevel,runId:'fixture-executor-run'});
   }
   if(failExecution)throw Error('native-execution-failure');
   return {runId:'fixture-executor-run',outcome:{kind:'settled',status:'completed'}};
  },
  isReplyOperationSuperseded:()=>false,
  recordReplyOperationAgentTurn(){order.push('record-outcome')},
  finalizeReplyAgentRun:async()=>({text:'fixture-final'}),
  markPostCompactionModelFailurePayload:(_failure,payload)=>payload
 };
 const make=new AsyncFunction(...Object.keys(deps),nativeFunction+'\nreturn executePreparedReplyAgentRun;');
 const classify=async()=>{classifications++;order.push('classify');assert.ok(admitted&&adopted);if(abortAtClassify)abort.abort(Error('native-cancel'));if(revokeAtClassify)revoked=true;return JSON.stringify(classification)};
 return {async run(){const release=registerClassifier(classify);try{return await (await make(...Object.values(deps)))(input)}finally{release()}},order,receipts,entry,original,queued,get calls(){return calls},get classifications(){return classifications}};
}
test('actual idle native dispatcher routes only after native admission and adoption',async()=>{
 const h=harness();assert.deepEqual(await h.run(),{text:'fixture-final'});assert.equal(h.classifications,1);assert.equal(h.calls,1);assert.ok(h.order.indexOf('admit')<h.order.indexOf('adopt'));assert.ok(h.order.indexOf('adopt')<h.order.indexOf('classify'));assert.ok(h.order.indexOf('classify')<h.order.indexOf('execute'));assert.equal(h.queued.run,h.original);assert.deepEqual(h.entry,{});
 assert.ok(h.receipts.some(r=>r.phase==='classified'&&r.kind==='LEVE'));
 assert.ok(h.receipts.some(r=>r.phase==='candidate-selected'&&r.nativeInputId==='fixture-native-input'&&r.runId==='fixture-executor-run'&&r.model==='openai/gpt-6-luna'&&r.effort==='low'));
});
test('actual idle duplicate source cannot classify or execute',async()=>{const h=harness({duplicate:true});assert.deepEqual(await h.run(),{duplicate:true});assert.equal(h.classifications,0);assert.equal(h.calls,0);assert.equal(h.queued.run,h.original)});
test('actual idle manual effort pin is preserved and refuses before classification',async()=>{const h=harness({pin:true});await assert.rejects(h.run(),/manual_session_thinking_conflict/);assert.equal(h.calls,0);assert.equal(h.classifications,0);assert.deepEqual(h.entry,{thinkingLevel:'medium'});assert.equal(h.queued.run,h.original)});
test('actual idle cancellation during classification never dispatches',async()=>{const h=harness({abortAtClassify:true});await assert.rejects(h.run(),/native-cancel/);assert.equal(h.calls,0);assert.equal(h.queued.run,h.original)});
test('actual idle authority revocation during classification never dispatches',async()=>{const h=harness({revokeAtClassify:true});await assert.rejects(h.run(),/native-authority-revoked/);assert.equal(h.calls,0);assert.equal(h.queued.run,h.original)});
test('actual idle executor error restores ephemeral run without changing history state',async()=>{const h=harness({failExecution:true});await assert.rejects(h.run(),/native-execution-failure/);assert.equal(h.calls,1);assert.equal(h.queued.run,h.original);assert.deepEqual(h.entry,{})});
test('actual idle neighbouring channel remains on original operation',async()=>{const h=harness({neighbour:true});assert.deepEqual(await h.run(),{text:'fixture-final'});assert.equal(h.classifications,0);assert.equal(h.calls,1);assert.equal(h.queued.run,h.original);assert.deepEqual(h.receipts,[])});
test('both native entry paths and native authority binding stay present',()=>{
 const follow=source.slice(source.indexOf('async function executeFollowupTurn'),source.indexOf('async function executePreparedReplyAgentRun'));
 assert.ok(follow.indexOf('recovery.admitUserTurn(recorder)')<follow.indexOf('execution = await runTelegramOwner'));
 assert.ok(follow.indexOf('bindToolAuthoritySnapshotAsync(')<follow.indexOf('execution = await runTelegramOwner'));
 assert.ok(nativeFunction.indexOf('await admitUserTurn(')<nativeFunction.indexOf('runInitialTelegramOwner({'));
 assert.ok(nativeFunction.indexOf('await turnAdoptionLifecycle?.onAdopted()')<nativeFunction.indexOf('runInitialTelegramOwner({'));
 const outer=source.slice(source.indexOf('async function runReplyAgent(params)'));
 assert.ok(outer.indexOf('await replyOperation.bindToolAuthoritySnapshotAsync(')<outer.indexOf('await executePreparedReplyAgentRun({'));
});

const {readRoutedAccountingSelection}=await import('../.generated/dist/telegram-route-owner.mjs');
function nativeHelper(name,deps) {
 const start=source.indexOf('function '+name+'('),end=source.indexOf('\n}',start)+2;
 assert.ok(start>=0&&end>start);
 return Function(...Object.keys(deps),source.slice(start,end)+'\nreturn '+name)(...Object.values(deps));
}
const noticeDeps={buildModelCatalogRef:(p,m)=>p+'/'+m,areRuntimeModelRefsEquivalent:(a,b)=>a===b,buildFallbackReasonSummary:attempts=>attempts[0]?.reason??'selected model unavailable'};
const nativeFallbackNotice=nativeHelper('buildFallbackNotice',noticeDeps);
const nativeFallbackTransition=nativeHelper('resolveFallbackTransition',{...noticeDeps,normalizeOptionalString:x=>typeof x==='string'&&x.trim()?x.trim():undefined,truncateFallbackReasonPart:x=>x,formatFallbackAttemptReason:a=>a.reason});
test('native accounting compares actual model to verified per-turn router selection',async()=>{
 const h=harness();await h.run();const selection=readRoutedAccountingSelection(h.queued,'fixture-executor-run');
 assert.equal(selection.model,'gpt-6-luna');assert.equal(selection.effort,'low');assert.equal(h.queued.run.thinkLevel,'medium');assert.ok(Object.isFrozen(selection));
 const params={selectedProvider:selection.provider,selectedModel:selection.model,activeProvider:'openai',activeModel:'gpt-6-luna',attempts:[],cfg:{}};
 assert.equal(nativeFallbackNotice(params),null);assert.equal(nativeFallbackTransition(params).fallbackActive,false);
 assert.ok(source.includes('const configuredFallbackModel = routedAccountingSelection ?? resolveFallbackOriginModel({'));
 assert.ok(source.includes('reasoningEffort: routedAccountingSelection?.effort ??'));
});
test('native accounting preserves genuine model-failure notices',async()=>{
 const h=harness();await h.run();const selection=readRoutedAccountingSelection(h.queued,'fixture-executor-run');
 const params={selectedProvider:selection.provider,selectedModel:selection.model,activeProvider:'openai',activeModel:'gpt-6-astra',attempts:[{provider:'openai',model:'gpt-6-luna',reason:'timeout'}],cfg:{}};
 assert.match(nativeFallbackNotice(params),/Model Fallback:.*timeout/);assert.equal(nativeFallbackTransition(params).fallbackActive,true);
});
test('accounting selection cannot be borrowed by another run, object or channel',async()=>{
 const h=harness();await h.run();assert.equal(readRoutedAccountingSelection(h.queued,'different-run'),undefined);assert.equal(readRoutedAccountingSelection({...h.queued},'fixture-executor-run'),undefined);
 const other=harness({neighbour:true});await other.run();assert.equal(readRoutedAccountingSelection(other.queued,'fixture-executor-run'),undefined);
});
test('native previous fallback state still clears through existing bookkeeping',async()=>{
 const h=harness();await h.run();const selection=readRoutedAccountingSelection(h.queued,'fixture-executor-run');
 const params={selectedProvider:selection.provider,selectedModel:selection.model,activeProvider:'openai',activeModel:selection.model,attempts:[],cfg:{},state:{fallbackNotice:{selectedModel:'openai/gpt-6.1-sol',activeModel:'openai/gpt-6-luna',reason:'selected model unavailable'}}};
 const transition=nativeFallbackTransition(params);assert.equal(transition.fallbackActive,false);assert.equal(transition.fallbackCleared,true);assert.equal(transition.nextState.selectedModel,undefined);
});

test('actual idle native dispatcher executes author-approved Sol and exceptional Astra roles',async()=>{
 for(const [kind,expectedModel,expectedEffort] of [['NORMAL','gpt-6-sol','low'],['REVISAO','gpt-6-sol','high'],['COMPLEXO','gpt-6-astra','high']]){
  const h=harness({classification:{kind,risk:'low',confidence:0.99},expectedModel,expectedEffort});
  assert.deepEqual(await h.run(),{text:'fixture-final'});assert.equal(h.classifications,1);assert.equal(h.calls,1);
  assert.ok(h.order.indexOf('admit')<h.order.indexOf('classify'));assert.ok(h.order.indexOf('adopt')<h.order.indexOf('execute'));
  assert.equal(h.queued.run,h.original);assert.deepEqual(h.entry,{});
  assert.ok(h.receipts.some(r=>r.phase==='candidate-selected'&&r.model==='openai/'+expectedModel&&r.effort===expectedEffort));
 }
});
