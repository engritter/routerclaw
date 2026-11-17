// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Álvaro Ritter — Safety Engenharia
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const excluded=new Set(['.git','.generated','node_modules']);
const findings=[];let files=0;
function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(excluded.has(e.name))continue;const f=path.join(dir,e.name);if(e.isDirectory()){visit(f);continue;}files++;const t=fs.readFileSync(f,'utf8');if(e.name.endsWith('.json')){try{JSON.parse(t);}catch{findings.push(path.relative(root,f)+': invalid JSON evidence or configuration');}}if(/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(t))findings.push(path.relative(root,f)+': private key marker');if(/(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{30,}/.test(t))findings.push(path.relative(root,f)+': possible GitHub credential');if(/\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/.test(t))findings.push(path.relative(root,f)+': possible bot credential');if(/srv[0-9]{5,}|\.tail[a-z0-9]+\.ts\.net|C:[\\/]Users[\\/]|[0-9]{8,}\/[A-Za-z0-9_-]{20,}/.test(t))findings.push(path.relative(root,f)+': possible private deployment identifier');}}
visit(root);if(findings.length){console.error(findings.join('\n'));process.exit(1);}console.log('Public-package pattern check passed: '+files+' files. This is a limited pattern scan, not a security audit.');
