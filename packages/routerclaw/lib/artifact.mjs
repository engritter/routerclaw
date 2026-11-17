// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Álvaro Ritter — Safety Engenharia
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const packageRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
export function parseJSON(data,label='JSON input'){try{return JSON.parse(data);}catch{throw Error('RouterClaw: invalid JSON in '+label);}}
export const readJSON=file=>parseJSON(fs.readFileSync(file,'utf8'),path.basename(file));
export const fail=message=>{throw Error('RouterClaw: '+message);};
export function requireNode(){const [major,minor,patch]=process.versions.node.split('.').map(Number);if(!((major===24&&(minor>22||(minor===22&&patch>=1)))||(major===26&&(minor>12||(minor===12&&patch>=1)))))fail('Node 24.22.1+ or 26.12.1+ within those major lines is required');}
export function inside(root,child){const relative=path.relative(root,child);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
export function safeRelative(relative){if(typeof relative!=='string'||!relative||relative.includes('\\')||relative.split('/').some(v=>!v||v==='.'||v==='..')||path.isAbsolute(relative))fail('unsafe artifact path');return relative;}
export function regular(file){if(!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())fail('expected a regular file: '+path.basename(file));return file;}
export function bindings(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('explicit owner settings are required');
 if(Object.keys(value).sort().join(',')!=='accountId,agentId,authProfileId,ownerId')fail('owner settings must contain only ownerId, agentId, accountId and authProfileId');
 if(typeof value.ownerId!=='string'||!/^\d{5,18}$/.test(value.ownerId))fail('ownerId must identify one private Telegram user');
 for(const key of ['agentId','accountId'])if(typeof value[key]!=='string'||!/[a-z]/.test(value[key])||!/^[a-z][a-z0-9_-]{0,63}$/.test(value[key]))fail('invalid '+key);
 if(typeof value.authProfileId!=='string'||!/^openai:[^\s\x00-\x1f]{1,180}$/.test(value.authProfileId))fail('authProfileId must name an existing OpenAI OAuth profile, never a token');
 return Object.freeze({ownerId:value.ownerId,agentId:value.agentId,accountId:value.accountId,authProfileId:value.authProfileId});
}
export function verifyArtifact(root=packageRoot){
 requireNode();
 const manifest=readJSON(path.join(root,'adapter/manifest.json'));
 if(manifest.schema!==1||manifest.hostVersion!=='2026.11.1'||Object.keys(manifest.sources??{}).length!==9)fail('unsupported adapter manifest');
 for(const [name,digest]of Object.entries(manifest.templates??{})){
  const file=path.join(root,'adapter',safeRelative(name));regular(file);
  if(hash(fs.readFileSync(file))!==digest)fail('adapter artifact changed: '+name);
 }
 if(Object.keys(manifest.templates??{}).length!==11)fail('incomplete adapter');
 return manifest;
}
export function renderAdapter(value,root=packageRoot){
 const b=bindings(value),manifest=verifyArtifact(root),files={};
 for(const name of Object.keys(manifest.templates))files[name]=fs.readFileSync(path.join(root,'adapter',name),'utf8');
 // Exact substitutions are applied only to our two helper templates, never to upstream bodies.
 let owner=files['dist/lab-route-owner.mjs'];
 const oldProfile="export const oauthProfile = 'openai:router-owner@example.test';";
 if(owner.split(oldProfile).length!==2)fail('profile template anchor drift');
 owner=owner.replace(oldProfile,'export const oauthProfile = '+JSON.stringify(b.authProfileId)+';').replaceAll('lab-router-6778','routerclaw').replace("process.env.OPENCLAW_LAB_ROUTE_OWNER === '6778'","process.env.ROUTERCLAW_ENABLED === '1'").replace('safety.development-host.route-owner.6778.v1','routerclaw.host-owner.v1');
 let telegram=files['dist/telegram-route-owner.mjs'];
 telegram=telegram.replace("const key='agent:main:telegram:default:direct:1111111111';",'const key='+JSON.stringify(`agent:${b.agentId}:telegram:${b.accountId}:direct:${b.ownerId}`)+';')
  .replaceAll("==='main'",'==='+JSON.stringify(b.agentId)).replaceAll("!=='main'",'!=='+JSON.stringify(b.agentId))
  .replaceAll("==='default'",'==='+JSON.stringify(b.accountId)).replaceAll("!=='default'",'!=='+JSON.stringify(b.accountId))
  .replaceAll("==='1111111111'",'==='+JSON.stringify(b.ownerId)).replaceAll("!=='1111111111'",'!=='+JSON.stringify(b.ownerId));
 if(telegram.includes("const key='agent:main:")||telegram.includes("==='1111111111'"))fail('owner template anchor drift');
 files['dist/lab-route-owner.mjs']=owner+'\nexport const routerclawBindings=Object.freeze('+JSON.stringify(b)+');\n';files['dist/telegram-route-owner.mjs']=telegram;
 return {bindings:b,manifest,files};
}
export function verifyInstallation(directory,root=packageRoot){
 const dir=fs.realpathSync(directory);const state=readJSON(regular(path.join(dir,'installation.json')));
 if(state.schema!==1||state.packageVersion!==readJSON(path.join(root,'package.json')).version)fail('installation belongs to another package version');
 const rendered=renderAdapter(state.bindings,root);const candidate=path.join(dir,'candidate');
 if(!inside(dir,fs.realpathSync(candidate)))fail('candidate escapes its installation');
 for(const [name,text]of Object.entries(rendered.files)){
  const file=regular(path.join(candidate,name));if(!inside(candidate,fs.realpathSync(file))||hash(fs.readFileSync(file))!==hash(text))fail('prepared adapter changed: '+name);
 }
 return {dir,state,candidate,rendered};
}
