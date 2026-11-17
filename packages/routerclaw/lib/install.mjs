// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Álvaro Ritter — Safety Engenharia
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {packageRoot,readJSON,parseJSON,hash,fail,inside,regular,bindings,verifyArtifact,renderAdapter,verifyInstallation} from './artifact.mjs';
export function writePrivate(file,value){
 const temporary=file+'.routerclaw-'+randomUUID();
 fs.writeFileSync(temporary,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
 try{fs.renameSync(temporary,file);fs.chmodSync(file,0o600);}catch(error){fs.unlinkSync(temporary);throw error;}
}
export function doctor(sourceRoot,root=packageRoot){
 const manifest=verifyArtifact(root),source=fs.realpathSync(sourceRoot),pkg=readJSON(regular(path.join(source,'package.json')));
 if(pkg.name!=='openclaw'||pkg.version!==manifest.hostVersion)fail('only the exact OpenClaw '+manifest.hostVersion+' baseline is supported');
 regular(path.join(source,'dist/index.js'));
 for(const [name,digest]of Object.entries(manifest.sources))if(hash(fs.readFileSync(regular(path.join(source,'dist',name))))!==digest)fail('native source drift: '+name);
 return {source,sourceEntrySHA256:hash(fs.readFileSync(path.join(source,'dist/index.js'))),hostVersion:manifest.hostVersion,verifiedNativeModules:9,runtimeReady:false,reason:'Preparation, native lifecycle checks and real message validation are still required.'};
}
export function mergeConfig(original,installation,root=packageRoot){
 const cfg=structuredClone(original);cfg.plugins??={};
 if(cfg.plugins.enabled===false||cfg.plugins.deny?.includes('routerclaw'))fail('RouterClaw is disabled by native plugin policy');
 if(cfg.plugins.entries?.['lab-router-6778']?.enabled)fail('an earlier development router is active; migrate it separately');
 if(cfg.plugins.entries?.routerclaw?.config?.installation)fail('another RouterClaw installation is configured');
 cfg.plugins.entries??={};const entry=cfg.plugins.entries.routerclaw??{};
 cfg.plugins.entries.routerclaw={...entry,enabled:true,config:{installation},hooks:{...entry.hooks,allowConversationAccess:true,allowPromptInjection:true}};
 if(cfg.plugins.allow&&!cfg.plugins.allow.includes('routerclaw'))cfg.plugins.allow=[...cfg.plugins.allow,'routerclaw'];
 cfg.plugins.load??={};const paths=cfg.plugins.load.paths??[];
 if(!Array.isArray(paths))fail('unsupported native plugin load path configuration');
 cfg.plugins.load.paths=paths.includes(root)?paths:[...paths,root];
 return cfg;
}
function noOverlap(a,b){if(a===b||inside(a,b)||inside(b,a))fail('installation must be separate from the source, plugin package and configuration directory');}
export function prepare({sourceRoot,configPath,destination,owner},root=packageRoot){
 const d=doctor(sourceRoot,root),b=bindings(owner),config=fs.realpathSync(regular(configPath));
 const target=path.resolve(destination),parent=fs.realpathSync(path.dirname(target));
 if(fs.existsSync(target))fail('destination already exists; previous installations are never overwritten');
 const resolvedTarget=path.join(parent,path.basename(target));noOverlap(resolvedTarget,d.source);noOverlap(resolvedTarget,fs.realpathSync(root));noOverlap(resolvedTarget,path.dirname(config));
 const originalBytes=fs.readFileSync(config),original=parseJSON(originalBytes,'OpenClaw configuration');
 if(original.agents?.list)fail('legacy agents.list requires a separate native migration; this installer never migrates agent histories');
 if(original.agents?.entries?!Object.hasOwn(original.agents.entries,b.agentId):b.agentId!=='main')fail('agentId is not in the existing keyed agent entries');
 const proposed=mergeConfig(original,resolvedTarget,root),rendered=renderAdapter(b,root);
 fs.mkdirSync(resolvedTarget,{mode:0o700});
 writePrivate(path.join(resolvedTarget,'preparation.json'),{schema:1,status:'preparing'});
 try{
  const candidate=path.join(resolvedTarget,'candidate');
  // Software only: never copy ~/.openclaw, sessions, credentials, memory or workspaces.
  fs.cpSync(d.source,candidate,{recursive:true,dereference:false,verbatimSymlinks:true,preserveTimestamps:true});
  const dist=path.join(candidate,'dist');if(fs.lstatSync(dist).isSymbolicLink()||!inside(candidate,fs.realpathSync(dist)))fail('copied dist must stay inside the candidate');
  for(const [name,text]of Object.entries(rendered.files)){
   const file=path.join(candidate,name);if(fs.existsSync(file)){regular(file);fs.chmodSync(file,0o644);}fs.writeFileSync(file,text,{mode:0o644});
  }
  const afterCopy=doctor(d.source,root);if(afterCopy.sourceEntrySHA256!==d.sourceEntrySHA256||hash(fs.readFileSync(path.join(candidate,'dist/index.js')))!==d.sourceEntrySHA256)fail('baseline changed during preparation');
  writePrivate(path.join(resolvedTarget,'proposed-config.json'),proposed);
  const state={schema:1,packageVersion:readJSON(path.join(root,'package.json')).version,status:'prepared-not-active',bindings:b,source:d.source,sourceEntrySHA256:d.sourceEntrySHA256,configPath:config,configSHA256:hash(originalBytes),candidate,packageRoot:fs.realpathSync(root),hostVersion:d.hostVersion,createdAt:new Date().toISOString(),historyCopied:false,credentialStoresCopied:false,privateConfigurationCopy:true,realMessageValidated:false};
  writePrivate(path.join(resolvedTarget,'installation.json'),state);verifyInstallation(resolvedTarget,root);
  writePrivate(path.join(resolvedTarget,'preparation.json'),{schema:1,status:'prepared-not-active'});
  return {installation:resolvedTarget,status:state.status,hostVersion:d.hostVersion,verifiedNativeModules:9,productionChanged:false};
 }catch(error){writePrivate(path.join(resolvedTarget,'preparation.json'),{schema:1,status:'failed-preserved',reason:error.message});throw error;}
}
function acquire(directory){const file=path.join(directory,'.lifecycle.lock');let descriptor;try{descriptor=fs.openSync(file,'wx',0o600);}catch{fail('another lifecycle operation owns this installation; inspect before retrying');}return()=>{fs.closeSync(descriptor);fs.unlinkSync(file);};}
function backup(file,destination){fs.copyFileSync(regular(file),destination);fs.chmodSync(destination,0o600);}
function unchanged(file,expected){if(hash(fs.readFileSync(regular(file)))!==expected)fail('configuration changed; refresh the preparation before altering the service');}
export async function activate(directory,backend,root=packageRoot){
 const checked=verifyInstallation(directory,root),{state,dir,candidate}=checked;const release=acquire(dir);
 let stopped=false,configWritten=false,dropinWritten=false,journal;
 try{
  if(state.packageRoot!==fs.realpathSync(root))fail('plugin package moved after preparation');
  if(doctor(state.source,root).sourceEntrySHA256!==state.sourceEntrySHA256)fail('baseline entry changed after preparation');
  unchanged(state.configPath,state.configSHA256);
  const info=await backend.inspect(state);if(info.activeEntry!==path.join(state.source,'dist/index.js'))fail('service is not running the verified baseline');
  if(path.resolve(info.effectiveConfig)!==state.configPath)fail('service uses a different configuration file');
  if(fs.existsSync(info.dropin))fail('RouterClaw service override already exists');
  const proposed=JSON.stringify(mergeConfig(readJSON(state.configPath),dir,root),null,2)+'\n';
  await backend.validate(candidate,path.join(dir,'proposed-config.json'));
  const activation=path.join(dir,'activation');if(fs.existsSync(activation))fail('activation evidence already exists; inspect it instead of overwriting');
  fs.mkdirSync(activation,{mode:0o700});backup(state.configPath,path.join(activation,'config-before.json'));writePrivate(path.join(activation,'service-before.txt'),info.unitText);
  journal={schema:1,status:'draining',configPath:state.configPath,configBefore:state.configSHA256,configAfter:hash(proposed),dropin:info.dropin,dropinAfter:null,source:state.source,candidate,service:info.service};
  writePrivate(path.join(activation,'state.json'),journal);
  const drain=await backend.suspend(state);writePrivate(path.join(activation,'drain.json'),drain);
  if(drain.status!=='ready'||drain.activeCount!==0||!Array.isArray(drain.blockers)||drain.blockers.length||!Array.isArray(drain.writeCustody)||drain.writeCustody.length)fail('active work did not drain; nothing was stopped');
  unchanged(state.configPath,state.configSHA256);await backend.assertUnchanged(info);
  await backend.stop(state);if(!await backend.isStopped())fail('service is still running; no files were changed');stopped=true;
  journal.activationNonce=randomUUID();const dropin=backend.renderDropin(info,candidate,journal.activationNonce);journal.dropinAfter=hash(dropin);
  // Recheck after stopping: concurrent edits must never be overwritten.
  unchanged(state.configPath,state.configSHA256);
  fs.mkdirSync(path.dirname(info.dropin),{recursive:true,mode:0o700});
  writePrivate(state.configPath,proposed);configWritten=true;fs.writeFileSync(info.dropin,dropin,{mode:0o600,flag:'wx'});dropinWritten=true;
  journal.status='starting';writePrivate(path.join(activation,'state.json'),journal);
  await backend.reload();await backend.assertTarget(candidate);await backend.start(state);
  const health=await backend.health(state);if(health.ok!==true||!await backend.isTargetRunning(candidate)||!await backend.isRouterReady(dir,journal.activationNonce))fail('prepared Gateway or RouterClaw classifier did not become ready');
  writePrivate(path.join(activation,'health.json'),{ok:true,checkedAt:new Date().toISOString()});
  journal.status='active-awaiting-real-message';writePrivate(path.join(activation,'state.json'),journal);
  return {status:journal.status,health:true,historyReset:false,realMessageValidated:false};
 }catch(error){
  if(error.nativeDiagnostic)writePrivate(path.join(dir,'native-command-failure.json'),error.nativeDiagnostic);
  if(stopped){
   try{
    await backend.stop(state);if(!await backend.isStopped())fail('cannot restore files while a Gateway still runs');
    if(configWritten)unchanged(state.configPath,journal.configAfter);
    if(dropinWritten){if(hash(fs.readFileSync(regular(journal.dropin)))!==journal.dropinAfter)fail('service override changed; manual recovery required');fs.unlinkSync(journal.dropin);}
    if(configWritten)writePrivate(state.configPath,fs.readFileSync(path.join(dir,'activation/config-before.json'),'utf8'));
    await backend.reload();await backend.start(state);
    const oldHealth=await backend.health(state);if(oldHealth.ok!==true)fail('previous Gateway health requires attention');
    journal.status='rolled-back';journal.failure=error.message;writePrivate(path.join(dir,'activation/state.json'),journal);
   }catch(rollbackError){if(rollbackError.nativeDiagnostic)writePrivate(path.join(dir,'native-recovery-failure.json'),rollbackError.nativeDiagnostic);if(journal){journal.status='manual-recovery-required';journal.failure=error.message;journal.recoveryFailure=rollbackError.message;writePrivate(path.join(dir,'activation/state.json'),journal);}fail('activation failed; recovery needs attention. See private activation/state.json');}
  }
  throw error;
 }finally{release();}
}
export async function rollback(directory,backend,root=packageRoot){
 const {dir,state,candidate}=verifyInstallation(directory,root),release=acquire(dir);
 try{
  const journal=readJSON(path.join(dir,'activation/state.json'));if(journal.status!=='active-awaiting-real-message')fail('this installation is not eligible for automatic rollback');
  unchanged(state.configPath,journal.configAfter);
  if(hash(fs.readFileSync(regular(journal.dropin)))!==journal.dropinAfter)fail('service override changed; do not overwrite it');
  const info=await backend.inspect(state);if(info.activeEntry!==path.join(candidate,'dist/index.js'))fail('another executable owns the service');
  const drain=await backend.suspend(state);if(drain.status!=='ready'||drain.activeCount!==0||!Array.isArray(drain.blockers)||drain.blockers.length||!Array.isArray(drain.writeCustody)||drain.writeCustody.length)fail('work did not drain');
  await backend.assertUnchanged(info);await backend.stop(state);if(!await backend.isStopped())fail('service did not stop');
  unchanged(state.configPath,journal.configAfter);
  fs.unlinkSync(journal.dropin);writePrivate(state.configPath,fs.readFileSync(path.join(dir,'activation/config-before.json'),'utf8'));
  await backend.reload();await backend.start(state);const health=await backend.health(state);
  journal.status=health.ok===true?'rolled-back':'previous-gateway-needs-attention';writePrivate(path.join(dir,'activation/state.json'),journal);
  if(health.ok!==true)fail('previous Gateway did not become healthy');return {status:journal.status,historyReset:false};
 }finally{release();}
}
