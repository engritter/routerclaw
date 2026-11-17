> DRAFT / RASCUNHO — Do not submit or publish until Álvaro explicitly authorizes release.

# Per admitted turn model and reasoning selection

**Proposed title:** [Feature]: supported per-turn model and reasoning routing with native admission and truthful selection reporting

**Routing decision after reviewing prior art:** do not file this as another broad automatic-routing feature request. [Issue #85658](https://github.com/openclaw/openclaw/issues/85658) was closed as community/plugin scope; [#114264](https://github.com/openclaw/openclaw/issues/114264) discusses media-type routing. Keep this external reference separate, share the [implementation follow-up](UPSTREAM-COMMENT.md) in the existing discussion, and seek maintainer guidance before proposing a narrower source change. No core acceptance is implied.

## Summary

Provide a supported extension point to select model and reasoning effort for an already-admitted input, including idle and queued paths, without mutating shared session preferences.

## Problem to solve

We run OpenClaw for a small engineering company. Short questions, investigations and complex tasks need different execution choices. A prototype exposed three integration problems: an idle path could bypass a wrapper tested only on follow-ups; planned model selection could be reported as fallback against the configured default; independent administrative inference could inherit a parent extension's custom routing state.

Patching shared session preferences before a send and restoring them afterwards would introduce races and could overwrite a human's choice. We want a supported per-turn contract, not that pattern.

## Proposed solution

- Expose routing after native admission/adoption with the original input recorder, identity, abort and authority checks.
- Support model/provider/fallback selection together with a native per-turn reasoning-effort policy, preserving explicit human preferences.
- Distinguish planned selection from genuine fallback in status and accounting.
- Specify independent administrative-task isolation and documented callback/cancellation behavior.
- Expose metadata receipts that can be correlated with runtime execution and actual delivery, without raw messages or credentials.

The experiment uses semantic classification of kind/risk/confidence; uncertain or attached requests select the capable role. This is prior art to discuss, not a requirement to accept this particular classifier, model naming or generated patch.

## Alternatives considered

1. One fixed model: operationally simple, but no task-specific choice.
2. Manual switching: transparent, with ongoing operator work.
3. Session patch/send/restore: rejected because execution and restoration are not one proven atomic operation.
4. Model-resolution hook only: useful for model choice; the installed hook did not itself provide the complete reasoning/admission/accounting contract needed here.

## Impact

Affected: owner-operated Telegram conversations and extensions implementing per-message execution policy. In the observed deployment, the defects caused failed replies or misleading model reporting and required manual diagnosis. General prevalence is unknown; no measured cost, quota or throughput benefit is claimed.

## Evidence

- Baseline: OpenClaw 2026.11.1, revision 4ffdd20, official unmodified Codex plugin.
- Latest private qualification: 47 isolated tests passed (including the previous 41); 12 modules syntax checked.
- Eight later real Telegram inputs completed, with one recorded classification each, selected-model/runtime agreement and observed reply delivery: the earlier low/medium/high role mapping, review plus a read-only tool, queued follow-up and synthetic TXT attachment.
- Public reference, source fixtures, authorship and redacted matrix: https://github.com/engritter/routerclaw

These are bounded observations, not an independent audit or universal compatibility result. The repository documents how to reproduce isolated tests without credentials or live inference.

## Implementation intent

**Maybe, with maintainer guidance.** The prototype is implemented and observed in one deployment. Before a source PR, I would like guidance on whether this belongs in the plugin SDK, an external extension, or a focused core contract change. No generated distribution bundles are proposed for merge.

## Additional information

Known gaps: native /status still reports configuration defaults and universal command interception was not established; the exact native policy-race cause is unproven; narrowly scoped pre-prompt recovery and the 45-second classifier deadline lack equivalent live stress proof; broad media/callback coverage and post-terminal context-snapshot warnings remain. Credentials, raw chats and private infrastructure details are excluded.

Project creation and direction: **Álvaro Ritter — Safety Engenharia**. Engineering assistance: AI-assisted development tools. OpenClaw portions retain upstream attribution. This proposal follows the project's [architecture-first contribution guidance](https://github.com/openclaw/openclaw/blob/main/CONTRIBUTING.md).

The current author-approved policy uses Luna/low for simple turns, Sol/low for normal requests, Sol/high for review/media and Astra/high for exceptional cases. Historical results retain their original mapping. See the historical and Sol-default ledgers.
