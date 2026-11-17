// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Álvaro Ritter — Safety Engenharia
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {doctor,prepare,activate,rollback,mergeConfig} from '../packages/routerclaw/lib/install.mjs';
import {packageRoot,readJSON,hash,verifyArtifact,renderAdapter,verifyInstallation,bindings} from '../packages/routerclaw/lib/artifact.mjs';
import plugin from '../packages/routerclaw/index.mjs';
import {requireCanonicalState} from '../packages/routerclaw/lib/systemd.mjs';
const repo=path.resolve(import.meta.dirname,'..');
const owner={ownerId:'1111111111',agentId:'main',accountId:'default',authProfileId:'openai:router-owner@example.test'};
function fixture(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'routerclaw-test-'));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const source=path.join(base,'software'),configDir=path.join(base,'private-config'),installParent=path.join(base,'installs');
 for(const dir of [path.join(source,'dist'),configDir,installParent])fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(source,'package.json'),JSON.stringify({name:'openclaw',version:'2026.11.1'}));
 fs.writeFileSync(path.join(source,'dist/index.js'),'// synthetic executable; never starts a Gateway\n');
 for(const name of Object.keys(verifyArtifact().sources))fs.copyFileSync(path.join(repo,'fixtures/upstream',name),path.join(source,'dist',name));
 const config=path.join(configDir,'openclaw.json'),history=path.join(configDir,'history.txt');fs.writeFileSync(history,'preserve every conversation');
 const original={agents:{entries:{main:{},other:{}}},plugins:{allow:['another-plugin'],entries:{'another-plugin':{enabled:true,config:{unchanged:1}}}},channels:{telegram:{accounts:{default:{tokenRef:'synthetic-no-token'},other:{unchanged:true}}}},auth:{unrelated:'preserved'}};
 fs.writeFileSync(config,JSON.stringify(original,null,2)+'\n');
 const destination=path.join(installParent,'candidate');
 return {base,source,config,history,original,destination,prepare(){return prepare({sourceRoot:source,configPath:config,destination,owner});}};
}
function backend(f,options={}){
 const calls=[],dropin=path.join(f.base,'service.d/95-routerclaw.conf'),candidate=path.join(f.destination,'candidate');let stopped=false;
 const value={calls,dropin,
  async inspect(){calls.push('inspect');return {activeEntry:path.join(fs.existsSync(dropin)?candidate:f.source,'dist/index.js'),effectiveConfig:f.config,service:'synthetic.service',dropin,unitText:'synthetic original unit'};},
  async assertUnchanged(){calls.push('assertUnchanged');if(options.serviceDrift)throw Error('service drift');},
  async validate(){calls.push('validate');if(options.validationFailure)throw Error('validation failure');},
  async suspend(){calls.push('suspend');if(options.onDrain)options.onDrain();return options.busy?{status:'busy',activeCount:1,blockers:['active'],writeCustody:[]}:{status:'ready',activeCount:0,blockers:[],writeCustody:[]};},
  async stop(){calls.push('stop');stopped=true;},async isStopped(){return stopped;},
  renderDropin(){return 'synthetic prepared unit\n';},async reload(){calls.push('reload');},async assertTarget(){calls.push('assertTarget');},
  async start(){calls.push('start');stopped=false;if(options.startFailure&&fs.existsSync(dropin))throw Error('new start failed');},
  async health(){calls.push('health');if(options.healthFailure&&fs.existsSync(dropin))return {ok:false};return {ok:true};},
  async isTargetRunning(){return !stopped&&fs.existsSync(dropin);},async isRouterReady(){return !options.registrationFailure;}
 };return value;
}
test('release artifact has exactly the pinned sources and expected runtime files',()=>{const a=verifyArtifact();assert.equal(Object.keys(a.sources).length,9);assert.equal(Object.keys(a.templates).length,11);});
test('owner settings have no implicit account or credential and reject injection',()=>{
 assert.throws(()=>bindings({}),/owner settings/);assert.throws(()=>bindings({...owner,extra:1}),/only ownerId/);assert.throws(()=>bindings({...owner,ownerId:'-1000000'}),/private Telegram/);assert.throws(()=>bindings({...owner,authProfileId:'openai:test\nTOKEN'}),/profile/);assert.throws(()=>bindings({...owner,agentId:'main/other'}),/agentId/);
});
test('doctor checks real baseline bytes and refuses source/version drift',t=>{
 const f=fixture(t);assert.equal(doctor(f.source).verifiedNativeModules,9);const name=Object.keys(verifyArtifact().sources)[0];fs.appendFileSync(path.join(f.source,'dist',name),'drift');assert.throws(()=>doctor(f.source),/source drift/);
 fs.writeFileSync(path.join(f.source,'package.json'),JSON.stringify({name:'openclaw',version:'2026.11.2'}));assert.throws(()=>doctor(f.source),/exact OpenClaw/);
});
test('prepare copies software only and preserves original configuration/history',t=>{
 const f=fixture(t),before=fs.readFileSync(f.config);assert.equal(f.prepare().productionChanged,false);assert.deepEqual(fs.readFileSync(f.config),before);assert.equal(fs.readFileSync(f.history,'utf8'),'preserve every conversation');assert.ok(!fs.existsSync(path.join(f.destination,'candidate/history.txt')));assert.equal(verifyInstallation(f.destination).state.bindings.ownerId,owner.ownerId);assert.equal(readJSON(path.join(f.destination,'installation.json')).status,'prepared-not-active');
});
test('prepare refuses overwrite, overlap and another active development router',t=>{
 const f=fixture(t);f.prepare();assert.throws(()=>f.prepare(),/already exists/);assert.throws(()=>prepare({sourceRoot:f.source,configPath:f.config,destination:path.join(f.source,'nested'),owner}),/separate/);assert.throws(()=>mergeConfig({plugins:{entries:{'lab-router-6778':{enabled:true}}}},f.destination),/earlier development router/);
});
test('configuration merge scopes grants to this plugin and preserves all other data',()=>{
 const original={plugins:{allow:['old'],entries:{old:{enabled:true}}},channels:{telegram:{keep:true}},agents:{keep:true}};const clone=structuredClone(original),merged=mergeConfig(original,'/private/test');assert.deepEqual(original,clone);assert.deepEqual(merged.channels,original.channels);assert.deepEqual(merged.agents,original.agents);assert.deepEqual(merged.plugins.entries.old,original.plugins.entries.old);assert.deepEqual(merged.plugins.allow,['old','routerclaw']);assert.equal(merged.plugins.entries.routerclaw.hooks.allowConversationAccess,true);assert.throws(()=>mergeConfig({plugins:{enabled:false}},'/private/test'),/disabled/);
});
test('rendered native patches are byte-identical; only owned helpers receive bindings',()=>{
 const a=renderAdapter(owner),b=renderAdapter({...owner,ownerId:'2222222222',agentId:'other',accountId:'other',authProfileId:'openai:second'});
 for(const name of Object.keys(a.manifest.sources))assert.equal(a.files['dist/'+name],b.files['dist/'+name]);
 assert.notEqual(a.files['dist/telegram-route-owner.mjs'],b.files['dist/telegram-route-owner.mjs']);assert.match(b.files['dist/telegram-route-owner.mjs'],/agent:other:telegram:other:direct:2222222222/);
});
test('a changed prepared helper cannot be loaded by the plugin',t=>{const f=fixture(t);f.prepare();fs.appendFileSync(path.join(f.destination,'candidate/dist/lab-route-owner.mjs'),'\n// drift');assert.throws(()=>plugin.register({pluginConfig:{installation:f.destination}}),/adapter changed/);});
test('installing without preparation registers no router hooks or classifier',()=>{const warnings=[];plugin.register({pluginConfig:{},logger:{warn:s=>warnings.push(s)},registerService:()=>assert.fail('must not start'),on:()=>assert.fail('must not hook')});assert.match(warnings[0],/INACTIVE/);});
test('plugin loads verified private helper and its classifier uses the selected existing profile',async t=>{
 const f=fixture(t);f.prepare();process.env.ROUTERCLAW_ENABLED='1';process.env.ROUTERCLAW_ACTIVATION_NONCE='00000000-0000-4000-8000-000000000001';const hooks={},services=[];let request;
 plugin.register({pluginConfig:{installation:f.destination},logger:{warn(){},info(){}},runtime:{llm:{complete:async r=>{request=r;return {text:'{"kind":"NORMAL","risk":"low","confidence":0.99}'};}}},registerService:s=>services.push(s),on:(name,handler)=>hooks[name]=handler});
 services[0].start();t.after(()=>{services[0].stop();delete process.env.ROUTERCLAW_ENABLED;delete process.env.ROUTERCLAW_ACTIVATION_NONCE;});
 const host=createRequire(import.meta.url)(path.join(f.destination,'candidate/dist/lab-route-owner.mjs'));
 const signal=new AbortController().signal,recorder={resolveMessage:async()=>({idempotencyKey:'synthetic-current',content:'synthetic ordinary request',provenance:{kind:'external_user'}})};
 await host.runRouteOwner({recorder,assertCurrent(){},signal,agentId:'main',sessionKey:'synthetic',getConfig:()=>({plugins:{entries:{routerclaw:{enabled:true}}}})},async()=>{assert.equal(hooks.before_model_resolve().modelOverride,'gpt-6-sol');assert.equal(host.thinkingForRun(undefined),'low');});
 assert.equal(request.execution.authProfileId,owner.authProfileId);assert.equal(request.execution.mode,'isolated-agent-runtime');assert.equal(request.agentId,'main');
});
test('native activation drains before stop, checks health and reports real validation pending',async t=>{
 const f=fixture(t);f.prepare();const b=backend(f),r=await activate(f.destination,b);assert.equal(r.status,'active-awaiting-real-message');assert.equal(r.realMessageValidated,false);assert.ok(b.calls.indexOf('suspend')<b.calls.indexOf('stop'));assert.ok(b.calls.indexOf('stop')<b.calls.indexOf('start'));assert.deepEqual(readJSON(f.config).channels,f.original.channels);assert.equal(fs.readFileSync(f.history,'utf8'),'preserve every conversation');
});
test('busy work refuses activation without stopping or changing configuration',async t=>{const f=fixture(t),before=fs.readFileSync(f.config);f.prepare();const b=backend(f,{busy:true});await assert.rejects(activate(f.destination,b),/did not drain/);assert.ok(!b.calls.includes('stop'));assert.deepEqual(fs.readFileSync(f.config),before);});
test('configuration edits after prepare or during drain are preserved',async t=>{
 const f=fixture(t);f.prepare();const changed={...f.original,externalEdit:'preserve me'};const b=backend(f,{onDrain:()=>fs.writeFileSync(f.config,JSON.stringify(changed))});await assert.rejects(activate(f.destination,b),/configuration changed/);assert.ok(!b.calls.includes('stop'));assert.deepEqual(readJSON(f.config),changed);
});
test('service drift or native validation refusal never reaches stop',async t=>{
 for(const options of [{validationFailure:true},{serviceDrift:true}]){const f=fixture(t);f.prepare();const b=backend(f,options);await assert.rejects(activate(f.destination,b));assert.ok(!b.calls.includes('stop'));}
});
test('failed new start or health restores original configuration and service',async t=>{
 for(const options of [{startFailure:true},{healthFailure:true}]){const f=fixture(t),before=fs.readFileSync(f.config);f.prepare();const b=backend(f,options);await assert.rejects(activate(f.destination,b));assert.deepEqual(fs.readFileSync(f.config),before);assert.ok(!fs.existsSync(b.dropin));assert.equal(readJSON(path.join(f.destination,'activation/state.json')).status,'rolled-back');assert.equal(b.calls.filter(x=>x==='start').length,2);}
});
test('explicit rollback restores only an unchanged installation and keeps history',async t=>{
 const f=fixture(t),before=fs.readFileSync(f.config);f.prepare();const b=backend(f);await activate(f.destination,b);assert.equal((await rollback(f.destination,b)).status,'rolled-back');assert.deepEqual(fs.readFileSync(f.config),before);assert.equal(fs.readFileSync(f.history,'utf8'),'preserve every conversation');
});
test('rollback refuses to overwrite later user configuration changes',async t=>{
 const f=fixture(t);f.prepare();const b=backend(f);await activate(f.destination,b);const cfg=readJSON(f.config);cfg.businessChange='keep';fs.writeFileSync(f.config,JSON.stringify(cfg));const stops=b.calls.filter(x=>x==='stop').length;await assert.rejects(rollback(f.destination,b),/configuration changed/);assert.equal(b.calls.filter(x=>x==='stop').length,stops);assert.equal(readJSON(f.config).businessChange,'keep');
});
test('rendered adapter reproduces the original 47 native and ownership fixtures',t=>{
 const f=fixture(t);f.prepare();const tests=path.join(f.destination,'test');fs.mkdirSync(tests);fs.cpSync(path.join(repo,'fixtures'),path.join(f.destination,'fixtures'),{recursive:true});
 for(const name of ['route.test.mjs','initial.test.mjs']){let text=fs.readFileSync(path.join(repo,'test',name),'utf8').replaceAll('../.generated/','../candidate/').replaceAll('lab-router-6778','routerclaw').replace("process.env.OPENCLAW_LAB_ROUTE_OWNER='6778'","process.env.ROUTERCLAW_ENABLED='1'");
  if(name==='route.test.mjs'){
   const entry=JSON.stringify(pathToFileURL(path.join(packageRoot,'index.mjs')).href);
   text=text.replace("new URL('../candidate/plugin/index.mjs',import.meta.url)",`new URL(${entry})`).replace("import('../candidate/plugin/index.mjs')",`import(${entry})`).replace('plugin.register({registerService:s=>service=s,','plugin.register({pluginConfig:{installation:'+JSON.stringify(f.destination)+'},registerService:s=>service=s,');
  }
  fs.writeFileSync(path.join(tests,name),text);
 }
 const env={...process.env,ROUTERCLAW_ACTIVATION_NONCE:'00000000-0000-4000-8000-000000000002'};delete env.NODE_TEST_CONTEXT;
 const output=execFileSync(process.execPath,['--test','--test-reporter=tap',path.join(tests,'initial.test.mjs'),path.join(tests,'route.test.mjs')],{encoding:'utf8',env});assert.match(output,/pass 47/);assert.match(output,/fail 0/);
});
test('baseline entry drift after preparation refuses activation before lifecycle changes',async t=>{const f=fixture(t);f.prepare();fs.appendFileSync(path.join(f.source,'dist/index.js'),'\n// upgrade');const b=backend(f);await assert.rejects(activate(f.destination,b),/baseline entry changed/);assert.deepEqual(b.calls,[]);});
test('nondefault owner, agent and account route without borrowing adjacent identities',async t=>{
 const f=fixture(t),settings={ownerId:'2222222222',agentId:'other',accountId:'other',authProfileId:'openai:second'};
 prepare({sourceRoot:f.source,configPath:f.config,destination:f.destination,owner:settings});process.env.ROUTERCLAW_ENABLED='1';t.after(()=>delete process.env.ROUTERCLAW_ENABLED);
 const base=path.join(f.destination,'candidate/dist'),host=createRequire(import.meta.url)(path.join(base,'lab-route-owner.mjs')),telegram=createRequire(import.meta.url)(path.join(base,'telegram-route-owner.mjs'));let classifications=0;
 const release=host.registerClassifier(async()=>{classifications++;return '{"kind":"NORMAL","risk":"low","confidence":0.99}';});t.after(release);
 const signal=new AbortController().signal,recorder={resolveMessage:async()=>({idempotencyKey:'nondefault',content:'synthetic task',provenance:{kind:'external_user'}})},original={agentId:'other'};
 const turn={queued:{run:original,userTurnTranscriptRecorder:recorder},operation:{abortSignal:signal},session:{current:()=>({})}};
 const ctx={SessionKey:'agent:other:telegram:other:direct:2222222222',Provider:'telegram',OriginatingChannel:'telegram',AccountId:'other',ChatType:'direct',SenderId:'2222222222'};
 const input={turn,sessionCtx:ctx,recorder,assertCurrent(){},getConfig:()=>({plugins:{entries:{routerclaw:{enabled:true}}}})};
 await telegram.runTelegramOwner(input,async()=>{assert.equal(turn.queued.run.authProfileId,'openai:second');assert.equal(host.routeHook().modelOverride,'gpt-6-sol');assert.equal(turn.queued.run.thinkLevel,'low');});assert.equal(turn.queued.run,original);assert.equal(classifications,1);
 await telegram.runTelegramOwner({...input,sessionCtx:{...ctx,SenderId:'1111111111'}},async()=>assert.equal(turn.queued.run,original));assert.equal(classifications,1);
});
test('legacy agent configuration is refused without any implicit migration',t=>{const f=fixture(t);const cfg=structuredClone(f.original);cfg.agents={list:[{id:'main'}]};fs.writeFileSync(f.config,JSON.stringify(cfg));assert.throws(()=>f.prepare(),/separate native migration/);assert.deepEqual(readJSON(f.config),cfg);assert.ok(!fs.existsSync(f.destination));});
test('native canonical-state management guards are preserved before lifecycle operations',()=>{const home=path.resolve('example-home'),config=path.join(home,'.openclaw/openclaw.json');requireCanonicalState(home,config,{});assert.throws(()=>requireCanonicalState(home,path.join(home,'custom.json'),{}),/canonical/);assert.throws(()=>requireCanonicalState(home,config,{OPENCLAW_STATE_DIR:path.resolve('other-state')}),/canonical/);assert.throws(()=>requireCanonicalState(home,config,{OPENCLAW_PROFILE:'other'}),/canonical/);});
test('healthy Gateway without its registered classifier rolls back rather than claiming activation',async t=>{const f=fixture(t);f.prepare();const before=fs.readFileSync(f.config);await assert.rejects(activate(f.destination,backend(f,{registrationFailure:true})),/classifier did not become ready/);assert.deepEqual(fs.readFileSync(f.config),before);assert.equal(readJSON(path.join(f.destination,'activation/state.json')).status,'rolled-back');});
