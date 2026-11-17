# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Álvaro Ritter — Safety Engenharia
from pathlib import Path
import hashlib,json,difflib,shutil
r=Path(__file__).resolve().parent.parent
expected=json.loads((r/'fixtures/upstream-manifest.json').read_text())
expected['sources']['system-agent-Cl6ELMrR.mjs']='53afa4781ae9ad6df5a0a6d2a11336e559db065d703e5d1d3b025a2030c799b7'
expected['sources']['selection-CecZuDT-.mjs']='15cf3b333779c77c2674a6e8e790e4b91f5f0aceffaef9dd3b6b498f66520a18'
src=r/'fixtures/upstream'
out=r/'.generated';(out/'dist').mkdir(parents=True,exist_ok=True)
manifest={'scope':'telegram main/default direct 1111111111 only','sources':{},'outputs':{}}
patch=[]
def once(s,a,b):
 if s.count(a)!=1:raise RuntimeError('anchor drift: '+a[:100])
 return s.replace(a,b,1)
for name in ['setup-A6bM8Yvp.mjs','run-entry-D6w0ZxSt.mjs','agent-runner-run-BjYtW0ag.mjs','get-reply-BnwmFitU.mjs','bot-native-command-dispatch-B32RuGgZ.mjs','prepare-auth-CZ3ZGxd8.mjs','isolated-completion-DG-kjkqs.mjs','system-agent-Cl6ELMrR.mjs','selection-CecZuDT-.mjs']:
 original=(src/name).read_text();s=original
 if hashlib.sha256(original.encode()).hexdigest()!=expected['sources'][name]:raise RuntimeError('Official source drift: '+name)
 if name.startswith('selection-Cec'):
  s='import { recoverNativePolicyPreparation } from "./lab-route-owner.mjs";\n'+s
  s=once(s,'async function runAgentHarnessOperation(harness, params, execute) {','async function runAgentHarnessOperation(harness, params, execute) {\n return recoverNativePolicyPreparation(harness,params,()=>runAgentHarnessOperationOriginal(harness,params,execute));\n}\nasync function runAgentHarnessOperationOriginal(harness, params, execute) {')
 elif name.startswith('system-agent-Cl6'):
  s='import { runIndependentAdministration } from "./lab-route-owner.mjs";\n'+s
  s=once(s,'const pending = await runSystemAgentGatewayTask(async () => {','const pending = await runSystemAgentGatewayTask(() => runIndependentAdministration(async () => {')
  s=once(s,'\n\t\t});\n\t\tif (pending) {','\n\t\t}));\n\t\tif (pending) {')
 elif name.startswith('isolated-completion-'):
  s='import { validateSubscriptionRuntime } from "./lab-route-owner.mjs";\n'+s
  s=once(s,'async function runCliIsolatedCompletion(request, provider, modelProvider) {','async function runCliIsolatedCompletion(request, provider, modelProvider) {\n validateSubscriptionRuntime("cli",true,request.authProfileId);')
 elif name.startswith('prepare-auth-'):
  s='import { validatePreparedSubscription } from "./lab-route-owner.mjs";\n'+s
  s=once(s,'function prepareAgentRuntimeAuth(input) {','function prepareAgentRuntimeAuth(input) {\n return validatePreparedSubscription(input, prepareAgentRuntimeAuthOriginal(input));\n}\nfunction prepareAgentRuntimeAuthOriginal(input) {')
 elif name.startswith('setup-'):
  s='import { requireRouteSelection as telegramRequireSelection } from "./lab-route-owner.mjs";\n'+s
  s=once(s,'async function resolveHookModelSelection(params) {','async function resolveHookModelSelection(params) {\n return telegramRequireSelection(params, resolveHookModelSelectionOriginal);\n}\nasync function resolveHookModelSelectionOriginal(params) {')
 elif name.startswith('run-entry'):
  s='import { validateRunEntrySelection as telegramValidateSelection } from "./lab-route-owner.mjs";\n'+s
  s=once(s,'\tconst hookOwnsFallbacks = hookSelection?.fallbacksOverride !== void 0;','\ttelegramValidateSelection(hookSelection, params.modelResolve?.modelSelectionLocked);\n\tconst hookOwnsFallbacks = hookSelection?.fallbacksOverride !== void 0;')
 elif name.startswith('get-reply-'):
  s='import { gateIngress, gateQueue, scopedQueueMode } from "./telegram-route-owner.mjs";\n'+s
  s=once(s,'\tconst explicitSteerTargetSessionKey =', '\tgateIngress(finalized.SessionKey?.split(":")[1], finalized, opts);\n\tconst explicitSteerTargetSessionKey =')
  s=once(s,'inlineMode: effectiveQueueMode,', 'inlineMode: scopedQueueMode(agentId, sessionCtx, opts, {cfg, sessionEntry, inlineMode:effectiveQueueMode}),')
  s=once(s,'\tconst embeddedAgentRuntime = useFastReplyRuntime ? null :', '\tgateQueue(agentId, sessionCtx, opts, resolvedQueue.mode);\n\tconst embeddedAgentRuntime = useFastReplyRuntime ? null :')
 elif name.startswith('bot-native-command-dispatch-'):
  s='import { gateNativeCommand } from "./telegram-route-owner.mjs";\n'+s
  s=once(s,'\tconst { route, bindingMode } = auth.inspectedRoute;', '\tgateNativeCommand(params, auth);\n\tconst { route, bindingMode } = auth.inspectedRoute;')
 else:
  s='import { o as telegramRuntimeConfig } from "./runtime-snapshot-DIGgB9w-.mjs";\nimport { runTelegramOwner, runInitialTelegramOwner, readRoutedAccountingSelection } from "./telegram-route-owner.mjs";\nimport { checkSelected as telegramCheckSelected, validateSubscriptionRuntime } from "./lab-route-owner.mjs";\n'+s
  s=once(s,'\t\t\tturn.opts?.onModelSelected?.({','\t\t\ttelegramCheckSelected({provider, model, thinkLevel: candidateThinkLevel, runId: turn.opts?.runId});\n\t\t\tturn.opts?.onModelSelected?.({')
  s=once(s,'execution = await withCurrentUserTurnInput(recorder, execute);','''execution = await runTelegramOwner({
                turn, sessionCtx, recorder,
                assertCurrent: createReplySourceReadGuard(turn.operation, turn.queued.operatorAuthority?.assertCurrent).assertReadCurrent,
                getConfig: telegramRuntimeConfig,
                emit: receipt => diagnosticLogger.info("telegram-route-6894", receipt)
            }, () => withCurrentUserTurnInput(recorder, execute));''')
  s=once(s,'''}, () => traceAgentPhase("reply.run_agent_turn", () => executeAgentTurn({
		...context,
		resolveVisibleReplyDelivery: input.resolveVisibleReplyDelivery,
		replyThreading: replyThreadingOverride ?? sessionCtx.ReplyThreading
	})));''','''}, () => runInitialTelegramOwner({
        initial: context,
        assertCurrent: createReplySourceReadGuard(replyOperation, followupRun.operatorAuthority?.assertCurrent).assertReadCurrent,
        getConfig: telegramRuntimeConfig,
        emit: receipt => diagnosticLogger.info("telegram-route-6894", receipt)
    }, () => traceAgentPhase("reply.run_agent_turn", () => executeAgentTurn({
        ...context,
        resolveVisibleReplyDelivery: input.resolveVisibleReplyDelivery,
        replyThreading: replyThreadingOverride ?? sessionCtx.ReplyThreading
    }))));''')
  s=once(s,'\tconst runtimeModelSelection = runResult.meta?.agentMeta?.runtimeModelSelection;','\tconst routedAccountingSelection = readRoutedAccountingSelection(followupRun, runId);\n\tconst runtimeModelSelection = runResult.meta?.agentMeta?.runtimeModelSelection;')
  s=once(s,'\tconst configuredFallbackModel = resolveFallbackOriginModel({','\tconst configuredFallbackModel = routedAccountingSelection ?? resolveFallbackOriginModel({')
  s=once(s,'reasoningEffort: typeof followupRun.run.thinkLevel === "string" ? followupRun.run.thinkLevel : void 0,','reasoningEffort: routedAccountingSelection?.effort ?? (typeof followupRun.run.thinkLevel === "string" ? followupRun.run.thinkLevel : void 0),')
  s=once(s,'\t\t\tparams.scheduledInference?.assertCandidate(provider, runtime.useCliExecution);','\t\t\tvalidateSubscriptionRuntime(candidateAgentRuntime, runtime.useCliExecution, candidateRun.authProfileId);\n\t\t\tparams.scheduledInference?.assertCandidate(provider, runtime.useCliExecution);')

 (out/'dist'/name).write_text(s)
 manifest['sources'][name]=hashlib.sha256(original.encode()).hexdigest()
 patch.extend(difflib.unified_diff(original.splitlines(True),s.splitlines(True),fromfile='a/dist/'+name,tofile='b/dist/'+name))
shutil.copyfile(r/'src/lab-route-owner.mjs',out/'dist/lab-route-owner.mjs')
shutil.copyfile(r/'src/telegram-route-owner.mjs',out/'dist/telegram-route-owner.mjs')
shutil.copytree(r/'plugin',out/'plugin',dirs_exist_ok=True)
(out/'host-core.patch').write_text(''.join(patch))
for p in sorted(out.rglob('*')):
 if p.is_file():manifest['outputs'][str(p.relative_to(out))]=hashlib.sha256(p.read_bytes()).hexdigest()
manifest['patchSha256']=hashlib.sha256((out/'host-core.patch').read_bytes()).hexdigest()
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Offline reference built from verified fixtures. No Gateway, credentials or network used.')
