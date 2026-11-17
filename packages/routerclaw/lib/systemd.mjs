// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Álvaro Ritter — Safety Engenharia
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fail,hash,parseJSON,readJSON,regular} from './artifact.mjs';
function invoke(command,args,options={}){try{return execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],...options});}catch(cause){const error=Error('RouterClaw: native command failed: '+path.basename(command)+' '+args.filter(a=>['gateway','stop','start','suspend','config','validate','health'].includes(a)).join(' '));Object.defineProperty(error,'nativeDiagnostic',{value:{exitCode:cause.status??null,stdout:String(cause.stdout??'').slice(0,32000),stderr:String(cause.stderr??'').slice(0,32000)}});throw error;}}
function quote(value){if(/[\r\n\0$%\\]/.test(value))fail('unsupported character in systemd argument');return JSON.stringify(value);}
export function requireCanonicalState(home,effectiveConfig,environment){
 const canonical=path.join(home,'.openclaw');
 if(environment.OPENCLAW_PROFILE?.trim()||path.resolve(effectiveConfig)!==path.join(canonical,'openclaw.json')||(environment.OPENCLAW_STATE_DIR&&path.resolve(environment.OPENCLAW_STATE_DIR)!==canonical))fail('this alpha requires the default canonical state/config paths; native service-management guards must not be bypassed');
}
export function systemdBackend(service='openclaw-gateway.service'){
 if(process.platform!=='linux'||process.getuid?.()===0)fail('activation requires Linux and the unprivileged user who owns the Gateway');
 if(!/^[a-zA-Z0-9_.@-]+\.service$/.test(service))fail('invalid service name');
 const ctl=(...args)=>invoke('systemctl',['--user',...args]);
 const show=property=>ctl('show',service,'--property='+property,'--value').trim();
 const dropin=path.join(process.env.XDG_CONFIG_HOME||path.join(os.homedir(),'.config'),'systemd/user',service+'.d/95-routerclaw.conf');
 let gatewayEnvironment={};
 // Reuse only in memory, under the service owner's UID. Never print or persist /proc environment values.
 const nativeEnv=config=>({...process.env,...gatewayEnvironment,OPENCLAW_CONFIG_PATH:config,OPENCLAW_SYSTEMD_UNIT:service});
 const native=(state,args,timeout=180000)=>parseJSON(invoke(process.execPath,[path.join(state.source,'dist/index.js'),...args],{env:nativeEnv(state.configPath),timeout}),'native command response');
 return {
  async inspect(){
   const pid=Number(show('MainPID'));if(!Number.isInteger(pid)||pid<=0)fail('Gateway must already be running before activation');
   const argv=fs.readFileSync('/proc/'+pid+'/cmdline').toString().split('\0').filter(Boolean);
   const entryIndex=argv.findIndex(a=>a.endsWith('/dist/index.js'));
   if(entryIndex<1||argv[entryIndex+1]!=='gateway'||fs.realpathSync(argv[0])!==fs.realpathSync(process.execPath))fail('only a direct Node Gateway user service is supported');
   const environment=Object.fromEntries(fs.readFileSync('/proc/'+pid+'/environ').toString().split('\0').filter(Boolean).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
   gatewayEnvironment=environment;
   const effectiveConfig=environment.OPENCLAW_CONFIG_PATH||path.join(environment.OPENCLAW_STATE_DIR||path.join(os.homedir(),'.openclaw'),'openclaw.json');
   requireCanonicalState(os.homedir(),effectiveConfig,environment);
   return {service,dropin,argv,entryIndex,activeEntry:argv[entryIndex],effectiveConfig,unitText:ctl('cat',service),execHash:hash(show('ExecStart')),pid};
  },
  async assertUnchanged(info){if(show('MainPID')!==String(info.pid)||hash(show('ExecStart'))!==info.execHash)fail('service changed during preparation');},
  async validate(candidate,config){const result=parseJSON(invoke(process.execPath,[path.join(candidate,'dist/index.js'),'config','validate','--json'],{env:nativeEnv(config),timeout:180000}),'native config validation');if(result.valid!==true)fail('native configuration validation did not confirm success');},
  suspend:state=>native(state,['gateway','suspend','--request-id','routerclaw-installer-'+Date.now(),'--wait','30','--json'],45000),
  stop:state=>native(state,['gateway','stop','--force','--json'],390000),
  // This installer owns the command override. Start it through systemd rather than
  // asking OpenClaw to repair/replace an operator-owned unit definition.
  async start(){ctl('start',service);},
  async health(state){
   const deadline=Date.now()+90000;
   for(let attempt=0;attempt<8;attempt++){
    try{const result=native(state,['health','--json'],30000);if(result.ok===true)return result;if(result.error?.type!=='gateway_transport_error')return result;}
    catch(error){let diagnostic;try{diagnostic=JSON.parse(error.nativeDiagnostic?.stdout??'');}catch{throw error;}if(diagnostic.error?.type!=='gateway_transport_error')throw error;}
    if(Date.now()>=deadline)break;await new Promise(resolve=>setTimeout(resolve,1500));
   }
   return {ok:false};
  },
  async isStopped(){return show('MainPID')==='0';},
  renderDropin(info,candidate,nonce){const argv=[...info.argv];argv[info.entryIndex]=path.join(candidate,'dist/index.js');return '[Service]\nExecStart=\nExecStart='+argv.map(quote).join(' ')+'\nEnvironment=ROUTERCLAW_ENABLED=1\nEnvironment=ROUTERCLAW_ACTIVATION_NONCE='+quote(nonce)+'\n';},
  async reload(){ctl('daemon-reload');},
  async assertTarget(candidate){if(!show('ExecStart').includes(path.join(candidate,'dist/index.js')))fail('effective unit does not select the prepared candidate');},
  async isTargetRunning(candidate){const pid=Number(show('MainPID'));return pid>0&&fs.readFileSync('/proc/'+pid+'/cmdline').toString().split('\0').includes(path.join(candidate,'dist/index.js'));}
  ,async isRouterReady(dir,nonce){const file=path.join(dir,'runtime-ready.json'),deadline=Date.now()+30000;while(Date.now()<deadline){const pid=Number(show('MainPID'));if(!pid)return false;if(fs.existsSync(file)){const ready=readJSON(regular(file));if(ready.active===true&&ready.nonce===nonce&&ready.pid===pid)return true;}await new Promise(resolve=>setTimeout(resolve,750));}return false;}
 };
}
