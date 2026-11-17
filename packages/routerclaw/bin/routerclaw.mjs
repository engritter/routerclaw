#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Álvaro Ritter — Safety Engenharia
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import {doctor,prepare,activate,rollback} from '../lib/install.mjs';
import {verifyInstallation,readJSON,fail} from '../lib/artifact.mjs';
import {systemdBackend} from '../lib/systemd.mjs';
const help=`RouterClaw experimental installer — Álvaro Ritter · Safety Engenharia

doctor   --source /absolute/openclaw
prepare  --source /absolute/openclaw --config /absolute/openclaw.json
         --destination /existing/private/parent/new-installation --owner-settings /private/owner.json
status   --installation /private/installation
activate --installation /private/installation [--service openclaw-gateway.service]
rollback --installation /private/installation [--service openclaw-gateway.service]

Owner file: {"ownerId":"YOUR_TELEGRAM_ID","agentId":"main","accountId":"default","authProfileId":"openai:EXISTING_PROFILE_LABEL"}
Use an existing OAuth profile label, never a password, bot token or API key.
Preparation changes no running service. Activation is explicit, Linux user-systemd only,
and refuses source drift, concurrent edits or active work that does not drain.
Only OpenClaw 2026.11.1 with the nine pinned module hashes is supported in this alpha.
No installation result proves routing until a new real Telegram message is validated.
`;
try{
 const {positionals,values}=parseArgs({allowPositionals:true,options:Object.fromEntries(['source','config','destination','owner-settings','installation','service'].map(k=>[k,{type:'string'}]).concat([['help',{type:'boolean'}]]))});
 const required=key=>values[key]||fail('--'+key+' is required');let result;
 if(values.help||!positionals.length){console.log(help);process.exit(0);}
 if(positionals.length!==1)fail('choose one command');
 switch(positionals[0]){
  case 'doctor':result=doctor(required('source'));break;
  case 'prepare':result=prepare({sourceRoot:required('source'),configPath:required('config'),destination:required('destination'),owner:readJSON(required('owner-settings'))});break;
  case 'status':{const v=verifyInstallation(required('installation'));const activation=v.dir+'/activation/state.json';result={status:fs.existsSync(activation)?readJSON(activation).status:v.state.status,hostVersion:v.state.hostVersion,artifactVerified:true,realMessageValidated:false};break;}
  case 'activate':result=await activate(required('installation'),systemdBackend(values.service));break;
  case 'rollback':result=await rollback(required('installation'),systemdBackend(values.service));break;
  default:fail('unknown command; use --help');
 }
 console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
