> DRAFT / RASCUNHO — Do not submit or publish until Álvaro explicitly authorizes release.

Sharing a concrete external implementation follow-up to this routing discussion: **[RouterClaw](https://github.com/engritter/routerclaw)**, created and directed by **Álvaro Ritter — Safety Engenharia**, with engineering assistance from AI-assisted development tools.

I understand that this was closed as community/plugin scope. I am not asking to bundle the router in core or to reopen the broad feature request.

Our prototype selects **model and reasoning effort per admitted message**, preserving the conversation and refusing conflicting explicit human preferences rather than using shared session patch/send/restore. On the observed OpenClaw 2026.11.1 deployment, the latest qualification passed **47 isolated tests**; eight historical real Telegram inputs completed with matching planned/runtime models and observed replies, including a read-only tool call, queued follow-up and synthetic TXT attachment. The sanitized reference reproduces the 47 fixture cases offline on Linux and Windows.

The repository keeps [evidence and limits](https://github.com/engritter/routerclaw/blob/main/docs/VALIDATION.md) separate: no measured quota/cost savings, no independent security audit, incomplete native command/callback and media coverage, an unproven preparation-race cause, and remaining post-terminal context-snapshot warnings. Local recovery qualification is not presented as recovery exercised in those eight live inputs. No raw chats, credentials or private host/account identifiers are included.

For a portable community plugin, what is the supported current SDK contract for **per-turn reasoning effort together with model selection**, covering both initially idle and queued inputs, and reporting planned selection separately from actual fallback? Is there an existing narrower thread we should follow?

This is an experimental source/test reference, **not an installable ClawHub release or a merge-ready distribution patch**. I would like to align the extension with the supported contract before packaging it for installation. OpenClaw fixtures retain the original copyright and MIT notice.

The current author-approved policy uses Luna/low for simple turns, Sol/low for normal requests, Sol/high for review/media and Astra/high for exceptional cases. Historical results retain their original mapping. See the historical and Sol-default ledgers.
