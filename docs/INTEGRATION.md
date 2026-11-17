# Integration scope and return plan

The original integration in this repository is a source-and-test reference; the owner/profile values in its fixtures are synthetic. A separate [RouterClaw experimental package and installer](../packages/routerclaw/README.md) is now being prepared for the exact pinned baseline. Its operator supplies existing profile labels privately; credentials must never be obtained from this repository. The reference files themselves must not replace a running Gateway.

The private prototype used a separately prepared, hash-verified development host against OpenClaw 2026.11.1. Only the exact owner DM was routed; unrelated configuration and agent behavior were intended to remain native. Actual proof is limited to the published matrix. The Codex plugin remained trusted-official and unmodified.

## Requirements before another deployment

- Review the installed version, source hashes and supported SDK contracts; stop on drift.
- Agree the owner/channel scope and explicit human-preference behavior. Do not clear a pin silently.
- Verify model availability, native harness, eligible auth route and fallback behavior before inference.
- Address the native command/callback gap and define cancellation behavior before claiming general support.
- Preserve service definition and configuration privately, drain native active work, and ensure only one Gateway owns the state.
- Validate health, exact effective configuration, new real inputs, tool behavior and delivered replies. Local tests cannot substitute for this step.

## Return to the prior version

Use the platform's native drain/stop lifecycle, restore the saved previous executable/overlay and unchanged service/configuration, then start one Gateway and verify health and channels. Preserve history, authentication and state. Do not delete sessions or databases to make a test pass. This is the documented deployment discipline, not an automated rollback shipped here.

## Proposed supported extension

The upstream discussion asks for a first-class per-admitted-turn selection contract that can carry model and reasoning effort while preserving native authority, human choices and true fallback reporting. The generated distribution patch is a reference for that discussion, not a merge-ready source PR.
