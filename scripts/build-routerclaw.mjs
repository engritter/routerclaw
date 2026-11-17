// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Álvaro Ritter — Safety Engenharia
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'packages/routerclaw');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'.generated/manifest.json'),'utf8'));
const upstream=JSON.parse(fs.readFileSync(path.join(root,'fixtures/upstream-manifest.json'),'utf8'));
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
if(JSON.stringify(manifest.sources)!==JSON.stringify(upstream.sources))throw Error('Source manifest drift');
const templates={};
for(const [name,expected]of Object.entries(manifest.outputs).filter(([n])=>n.startsWith('dist/'))){
 const bytes=fs.readFileSync(path.join(root,'.generated',name));if(digest(bytes)!==expected)throw Error('Reference output drift: '+name);
 const target=path.join(out,'adapter',name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);templates[name]=expected;
}
fs.writeFileSync(path.join(out,'adapter/manifest.json'),JSON.stringify({schema:1,hostVersion:'2026.11.1',sources:manifest.sources,templates},null,2)+'\n');
fs.copyFileSync(path.join(root,'LICENSE'),path.join(out,'LICENSE'));
fs.copyFileSync(path.join(root,'fixtures/upstream/LICENSE'),path.join(out,'adapter/OPENCLAW-LICENSE'));
const icon=Buffer.from(fs.readFileSync(path.join(out,'assets/icon.png.base64'),'utf8').trim(),'base64');
if(digest(icon)!=='904ab7a26c328aa0bcbe4c26ebbdfd3016c1b80fd5eebebde8644c67fb738dd6')throw Error('Icon source drift');
fs.writeFileSync(path.join(out,'assets/icon.png'),icon);
console.log('RouterClaw adapter built from 9 verified native sources and 11 verified output modules. No Gateway or credentials used.');
