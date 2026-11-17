// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Álvaro Ritter — Safety Engenharia
// Creation and project direction: Álvaro Ritter. Engineering assistance: AI-assisted development tools.
import {enabled,guardMode,runRouteOwner,thinkingForRun,oauthProfile} from './lab-route-owner.mjs';
const key='agent:main:telegram:default:direct:1111111111';
// Per-admitted-turn result accounting only. Never used to authorize dispatch or set a session pin.
const routedAccounting = new WeakMap();
export function readRoutedAccountingSelection(queued,runId) {
 const selection=routedAccounting.get(queued);
 return selection && typeof runId==='string' && selection.runId===runId ? selection : undefined;
}
export function contextInScope(agentId, ctx) {
 return agentId==='main' && ctx.SessionKey===key && ctx.Provider==='telegram' &&
 ctx.OriginatingChannel==='telegram' && ctx.AccountId==='default' && ctx.ChatType==='direct' &&
 String(ctx.SenderId)==='1111111111' && !ctx.MessageThreadId && !ctx.GroupThread &&
 (!ctx.InputProvenance || ctx.InputProvenance.kind==='external_user') && !ctx.InboundEventKind;
}
export function gateIngress(agentId, ctx, opts={}) {
 if (!enabled() || !contextInScope(agentId,ctx) || opts.scheduledAutomation || opts.internalEventExecution || opts.isHeartbeat) return;
 opts.abortSignal?.throwIfAborted(); opts.operatorAuthority?.assertCurrent?.();
 const texts=[ctx.RawBody,ctx.CommandBody,ctx.BodyForAgent,ctx.commandText,ctx.agentText];
 // Refuse every slash command, including inline selection/queue directives, before native mutation.
 if (texts.some(t=>typeof t==='string' && /(?:^|\s)\/[a-z][a-z0-9_-]*(?:@[a-z0-9_]+)?(?:\s|$|:)/i.test(t)))
  throw Error('telegram_route:pre_owner_command_refused');
 if (opts.queueModeOverride!==undefined) throw Error('telegram_route:pre_owner_queue_override_refused');
}
export function scopedQueueMode(agentId,ctx,opts,params) {
 if(!enabled() || !contextInScope(agentId,ctx) || opts?.scheduledAutomation || opts?.internalEventExecution || opts?.isHeartbeat) return params.inlineMode;
 // Only replace the implicit native default; preserve all explicit settings for the gate to check.
 if(params.inlineMode!=null || params.sessionEntry?.queueMode!=null ||
 params.cfg.messages?.queue?.mode!=null || params.cfg.messages?.queue?.byChannel?.telegram!=null) return params.inlineMode;
 return 'followup';
}
export function gateQueue(agentId,ctx,opts,mode) {
 if (!enabled() || !contextInScope(agentId,ctx) || opts?.scheduledAutomation || opts?.internalEventExecution || opts?.isHeartbeat) return;
 // No active injection, collect-then-run or interrupt may substitute for a separately routed input.
 if (!['followup'].includes(mode)) throw Error('telegram_route:pre_owner_queue_mode_refused');
}
export function gateNativeCommand(params,auth) {
 const route=auth.inspectedRoute.route;
 if (!enabled() || route.agentId!=='main' || params.accountId!=='default' ||
 auth.targetSessionKey!==key || auth.isGroup || auth.threadSpec.id!=null ||
 String(auth.senderId)!=='1111111111' || String(auth.chatId)!=='1111111111') return;
 auth.assertOwnerCurrent?.();
 throw Error('telegram_route:pre_owner_native_command_refused');
}
export function hasAttachments(ctx,q) {
 // Current-turn normalized facts survive audio transcription; never inspect history.
 return Boolean(ctx.media?.length || ctx.Sticker || ctx.StickerMediaIncluded ||
 ctx.MediaUnderstanding?.length || ctx.MediaUnderstandingDecisions?.length ||
 q.media?.length || q.images?.length || q.run.images?.length);
}
function queuedInScope(q, ctx) {
 const r=q.run;
 return r.agentId==='main' && ctx.SessionKey===key &&
  ctx.Provider==='telegram' && ctx.OriginatingChannel==='telegram' &&
  ctx.AccountId==='default' && ctx.ChatType==='direct' && String(ctx.SenderId)==='1111111111' &&
  !q.originatingThreadId && !r.scheduledAutomation && (!r.inputProvenance || r.inputProvenance.kind==='external_user');
}
export function inScope(turn,ctx) { return queuedInScope(turn.queued,ctx); }
async function runAdmittedTelegramOwner({queued:q,operation,currentSession,sessionCtx:ctx,recorder,assertCurrent,getConfig,emit},operationBody) {
 if (!enabled() || !queuedInScope(q,ctx)) return operationBody();
 const run=q.run;
 const check=()=>{
  assertCurrent();
  if(!queuedInScope(q,ctx)) throw Error('telegram_route:scope_changed');
  guardMode({},currentSession()??{});
  if(run.authProfileId && run.authProfileId!==oauthProfile) throw Error('telegram_route:manual_auth_profile_conflict');
  if(run.modelSelectionLocked || run.hasSessionModelOverride || run.thinkLevelOverride!==undefined || run.fastModeOverride || run.fastModeAutoOnSecondsOverride)
   throw Error('telegram_route:manual_selection_conflict');
 };
 check();
 return runRouteOwner({recorder,assertCurrent:check,signal:operation.abortSignal,
  agentId:run.agentId,sessionKey:ctx.SessionKey,getConfig,
  attachments:hasAttachments(ctx,q),emit:receipt=>{
   if(receipt.phase==='candidate-selected' && typeof receipt.runId==='string') {
    const model=receipt.model?.startsWith('openai/') ? receipt.model.slice(7) : undefined;
    if(['gpt-6-luna','gpt-6-astra','gpt-6-sol'].includes(model))
     routedAccounting.set(q,Object.freeze({provider:'openai',model,effort:receipt.effort,runId:receipt.runId,persistedAutoFallback:false}));
   }
   emit?.(receipt);
  }},async()=>{
   const original=q.run;
   q.run={...original,provider:'openai',authProfileId:oauthProfile,authProfileIdSource:'user',thinkLevel:thinkingForRun(undefined)};
   try { check(); return await operationBody(); }
   finally {q.run=original;}
 });
}
export function runTelegramOwner({turn,...source},operation) {
 return runAdmittedTelegramOwner({...source,queued:turn.queued,operation:turn.operation,currentSession:turn.session.current},operation);
}
export function runInitialTelegramOwner({initial,assertCurrent,getConfig,emit},operation) {
 // Invoked by the native initial dispatcher only after admitUserTurn and onAdopted,
 // inside the normal before-reply observer dispatch. Native tool authority is already bound.
 return runAdmittedTelegramOwner({queued:initial.followupRun,operation:initial.replyOperation,
  currentSession:initial.getActiveSessionEntry,sessionCtx:initial.sessionCtx,
  recorder:initial.followupRun.userTurnTranscriptRecorder,assertCurrent,getConfig,emit},operation);
}
