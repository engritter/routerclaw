// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Álvaro Ritter — Safety Engenharia
// Creation and project direction: Álvaro Ritter. Engineering assistance: AI-assisted development tools.
// DEVELOPMENT HOST FORK ONLY. Not authentication or quota evidence.
import { AsyncLocalStorage } from 'node:async_hooks';
// The plugin loader and native host can evaluate this module separately.
// Process-local bridge only; admission closures remain the authority.
const bridgeKey = Symbol.for('safety.development-host.route-owner.6778.v1');
const bridge = globalThis[bridgeKey] ??= {scope:new AsyncLocalStorage(),decisions:new WeakMap(),live:undefined};
const scope = bridge.scope;
const authScope = bridge.authScope ??= new AsyncLocalStorage();
export const oauthProfile = 'openai:router-owner@example.test';
// Only the authenticated native OpenClaw administration RPC uses this boundary.
// It removes this router's inherited selections; native caller, policy, approval and auth checks remain untouched.
export function runIndependentAdministration(operation) {
 return scope.run(undefined,()=>authScope.run(undefined,operation));
}

export function withSubscriptionBoundary(check, operation, audit) {
 return authScope.run({check,active:true,audit}, async()=>{const state=authScope.getStore();try{return await operation();}finally{state.active=false;}});
}
export function validatePreparedSubscription(input, prepared) {
 const state=authScope.getStore(); if(!state) return prepared;
 if(!state.active) fail('expired_auth_scope'); state.check();
 if(input.provider!=='openai' || input.sessionAuthProfileId!==oauthProfile ||
    !['user','user-link'].includes(input.sessionAuthProfileSource) ||
    input.authProfileStore?.profiles?.[oauthProfile]?.type!=='oauth' ||
    !(input.harnessId==='codex'||input.harnessRuntime==='codex')) fail('subscription_input_refused');
 const validPlan=p=>p?.providerForAuth==='openai' && p.harnessAuthProvider==='openai' &&
 p.forwardedAuthProfileId===oauthProfile && p.forwardedAuthProfileSource==='user' &&
 p.selectedAuthMode==='oauth' && p.modelRoute?.authRequirement==='subscription' &&
 (!p.forwardedAuthProfileCandidateIds || p.forwardedAuthProfileCandidateIds.every(id=>id===oauthProfile));
 if(!validPlan(prepared?.plan) || !prepared.attempts?.length || prepared.attempts.some(a=>
 a.kind!=='profile'||a.profileId!==oauthProfile||!validPlan(a.plan))) fail('subscription_plan_refused');
 state.audit?.({phase:'subscription-prepared',provider:'openai',harness:'codex',authMode:'oauth',authRequirement:'subscription',expectedProfileOnly:true});
 return prepared;
}
const decisions = bridge.decisions;
export const enabled = () => process.env.OPENCLAW_LAB_ROUTE_OWNER === '6778';
const fail = reason => { throw new Error(`lab_route:${reason}`); };
export function registerClassifier(classify) {
  if (typeof classify !== 'function' || bridge.live) fail('classifier_registration_conflict');
  const lease = { classify, active: true };
  bridge.live = lease;
  return () => { lease.active = false; if (bridge.live === lease) bridge.live = undefined; };
}
export function guardMode(p, entry = {}, busy = false) {
  if (!enabled()) return;
  if (p.queueMode !== undefined || busy) fail('steering_queue_busy_unsupported');
  if (entry.modelSelectionLocked || entry.modelOverride || entry.providerOverride || p.model !== undefined) fail('manual_model_or_locked_conflict');
  if (entry.thinkingLevel !== undefined) fail('manual_session_thinking_conflict');
  if (p.thinking !== undefined) fail('manual_thinking_preserved_request_refused');
  if (p.fastMode !== undefined || p.fastAutoOnSeconds !== undefined) fail('manual_fast_mode_conflict');
}
export function parseClassification(raw, attachments) {
  let c; try { c = JSON.parse(raw); } catch { fail('classifier_json'); }
  if (!c || Array.isArray(c) || Object.keys(c).sort().join(',') !== 'confidence,kind,risk' ||
      !['LEVE','NORMAL','REVISAO','COMPLEXO','DESCONHECIDO'].includes(c.kind) ||
      !['low','medium','high','unknown'].includes(c.risk) ||
      typeof c.confidence !== 'number' || !Number.isFinite(c.confidence) || c.confidence < 0 || c.confidence > 1) fail('classifier_schema');
  // Author-approved cost policy: Sol is the default; Astra is the exceptional tier.
  // Media alone raises the floor to Sol/high rather than selecting Astra.
  if (c.risk === 'high' || c.risk === 'unknown' || c.confidence < 0.85 || c.kind === 'DESCONHECIDO' || c.kind === 'COMPLEXO') return Object.freeze({model:'gpt-6-astra',effort:'high'});
  if (attachments || c.risk === 'medium' || c.kind === 'REVISAO') return Object.freeze({model:'gpt-6-sol',effort:'high'});
  if (c.kind === 'LEVE' && c.risk === 'low') return Object.freeze({model:'gpt-6-luna',effort:'low'});
  return Object.freeze({model:'gpt-6-sol',effort:'low'});
}
export async function runRouteOwner({recorder, assertCurrent, signal, agentId, sessionKey, getConfig, attachments = false, emit}, operation) {
  if (!enabled()) return operation();
  if (typeof assertCurrent !== 'function' || !signal || !recorder || typeof recorder.resolveMessage !== 'function') fail('host_capability_missing');
  const lease = bridge.live;
  const check = () => {
    signal.throwIfAborted(); assertCurrent();
    const cfg = getConfig();
    if (!lease) fail('plugin_retired_missing_lease');
    if (!lease.active || bridge.live !== lease) fail('plugin_retired_revoked_lease');
    if (cfg?.plugins?.enabled === false || (Array.isArray(cfg?.plugins?.allow) && !cfg.plugins.allow.includes('lab-router-6778')) || cfg?.plugins?.entries?.['lab-router-6778']?.enabled !== true) fail('plugin_retired');
    if (recorder.isBlocked?.()) fail('input_blocked');
  };
  check();
  const message = await recorder.resolveMessage(); check();
  const id = message?.idempotencyKey;
  if (typeof id !== 'string' || !id.trim()) fail('native_input_id_missing');
  // This value is from the admitted recorder, never from history or hook metadata.
  if (typeof message.content !== 'string' || !message.content.trim()) fail('text_input_required');
  if (message.content.trimStart().startsWith('/') || /(?:^|\s)\/(?:think|model|fast)\b/i.test(message.content)) fail('manual_directive_conflict');
  if (message.provenance && message.provenance.kind !== 'external_user') fail('non_user_input');
  let cached = decisions.get(recorder);
  if (cached && (cached.id !== id || cached.text !== message.content || cached.lease !== lease || cached.attachments !== attachments || cached.agentId !== agentId || cached.sessionKey !== sessionKey)) fail('input_or_owner_changed');
  if (!cached) {
    cached = {id, text:message.content, lease, attachments, agentId, sessionKey};
    // Store the promise before awaiting; concurrent rebuilds share exactly one classification.
    cached.promise = (async () => {
      const result = await withSubscriptionBoundary(check,()=>lease.classify({text:message.content, attachments}, signal), receipt=>{cached.classifierAuthVerified=true;emit?.({...receipt,nativeInputId:id,agentId,stage:'classifier',at:Date.now()})});
      check(); const decision=parseClassification(result, attachments);
      const {kind,risk,confidence}=JSON.parse(result);
      cached.classification={kind,risk,confidence};
      return decision;
    })();
    decisions.set(recorder, cached);
  }
  const decision = await cached.promise; check();
  const current = await recorder.resolveMessage(); check();
  if (current?.idempotencyKey !== id || current?.content !== cached.text) fail('input_changed_during_classification');
  const state = { decision, classification:cached.classification, classifierAuthVerified:cached.classifierAuthVerified===true, check, observed:false, active:true, id, agentId, sessionKey, emit };
  emit?.({dev:'lab-route-owner-6778',nativeInputId:id,agentId,phase:'classified',...cached.classification,attachments,at:Date.now()});
  return withSubscriptionBoundary(check,()=>scope.run(state, async () => {
    try {
      check();
      emit?.({dev:'lab-route-owner-6778',nativeInputId:id,agentId,model:`openai/${decision.model}`,effort:decision.effort,at:Date.now(),phase:'planned'});
      return await operation();
    } finally { state.active = false; }
  }), receipt=>{state.executorAuthVerified=true;emit?.({...receipt,nativeInputId:id,agentId,stage:'executor',runId:state.runId,at:Date.now()})});
}
function current() {
  const s = scope.getStore();
  if (s && !s.active) fail('expired_scope');
  s?.check(); return s;
}
export function thinkingForRun(original) {
  const s = current();
  if (!s) return original;
  if (original !== undefined) fail('manual_thinking_conflict');
  return s.decision.effort;
}
export function routeHook() {
  const s = current(); if (!s) return;
  if (!bridge.live?.active) fail('plugin_retired');
  s.observed = true;
  return {providerOverride:'openai',modelOverride:s.decision.model,fallbacksOverride:[]};
}
export async function requireRouteSelection(params, original) {
  const s = current(); if (!s) return original(params);
  if (params.modelSelectionLocked) fail('locked');
  s.observed = false;
  const result = await original(params); current();
  if (!s.observed) fail('own_hook_absent_or_failed');
  if (result.provider !== 'openai' || result.modelId !== s.decision.model || !Array.isArray(result.fallbacksOverride) || result.fallbacksOverride.length) fail('hook_selection_conflict');
  return result;
}
export function validateRunEntrySelection(selection, locked) {
  const s = current(); if (!s) return;
  if (locked) fail('locked');
  if (!s.observed || selection?.provider !== 'openai' || selection?.modelId !== s.decision.model || !Array.isArray(selection?.fallbacksOverride) || selection.fallbacksOverride.length) fail('run_entry_hook_required');
}
export function checkSelected(model) {
  const s = current(); if (!s) return;
  if (!s.observed || model.provider !== 'openai' || model.model !== s.decision.model || model.thinkLevel !== s.decision.effort) fail('selected_model_or_effort_conflict');
  s.runId=model.runId;
  s.emit?.({dev:'lab-route-owner-6778',nativeInputId:s.id,agentId:s.agentId,model:`${model.provider}/${model.model}`,effort:model.thinkLevel,at:Date.now(),phase:'candidate-selected',runId:model.runId});
}

export function validateSubscriptionRuntime(runtime,cli=false,profile=oauthProfile) {
 const state=authScope.getStore();if(!state)return;
 if(!state.active) fail('expired_auth_scope');state.check();
 if(runtime!=='codex'||cli||profile!==oauthProfile)fail('subscription_runtime_refused');
}

export function routePromptHook() {
 const s=current(); if(!s || !s.observed) return;
 const facts={selectedModel:'openai/'+s.decision.model,effort:s.decision.effort,classification:s.classification?.kind,selectionKind:'planned-per-message-router-selection',classifierSubscriptionPrepared:s.classifierAuthVerified===true,executorSubscriptionPrepared:s.executorAuthVerified===true};
 if(!s.contextEmitted) {s.contextEmitted=true;s.emit?.({phase:'context-provided',nativeInputId:s.id,agentId:s.agentId,runId:s.runId,...facts,at:Date.now()});}
 return {prependSystemContext:'[Trusted routing metadata for this admitted Telegram turn]\n'+JSON.stringify(facts)+'\nFor questions about the model answering this message, use selectedModel and effort above. Configured defaults and historical fallback notices do not prove a fallback for this turn. Report model unavailability only with an actual failing attempt for this turn. The openclaw administration tool uses an independent configured route; its setup checks do not identify the model of this reply.'};
}

export async function recoverNativePolicyPreparation(harness,params,operation) {
 const s=scope.getStore();
 const owned=enabled() && s?.active && harness?.id==='codex' && params.agentId===s.agentId && params.sessionKey===s.sessionKey && params.runId===s.runId && params.provider==='openai' && params.modelId===s.decision.model && (params.operation===undefined || params.operation==='run');
 if(!owned) return operation();
 const invoke=()=>{s.check();params.abortSignal?.throwIfAborted();return operation();};
 try {return await invoke();}
 catch(error) {
  // Only re-prepare a native attempt that never reached prompt construction.
  // No inference, delivered response or model-invoked tool can precede this point.
  // Native preparation, model policy, sender authority and execution-policy checks all run again.
  if(!(error instanceof Error) || error.message!=='Codex session execution policy changed; prepare the operation again.' || s.contextEmitted || s.preparationRetryUsed) throw error;
  s.check();params.abortSignal?.throwIfAborted();s.preparationRetryUsed=true;
  s.emit?.({phase:'preparation-retry',reason:'native_execution_policy_reprepare',nativeInputId:s.id,agentId:s.agentId,runId:s.runId,model:'openai/'+s.decision.model,effort:s.decision.effort,attempt:2,at:Date.now()});
  return invoke();
 }
}
