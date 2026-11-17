# Per message execution routing

The integration runs after native input admission and adoption, using the original recorder, input identity, reply operation, abort signal and authority checks. It wraps both the idle initial path and queued follow-up path. A mode name alone did not guarantee both paths were covered.

1. Read the admitted current input and native idempotency identity. Reject an invalid source, missing text or conflicting human override.
2. Bind a single classification promise to that recorder, input, scope and live classifier lease. Rebuilds share that promise; changing input or owner invalidates it.
3. Classify semantic kind, risk and confidence. Validate the closed JSON shape; uncertainty or attachments select the capable role rather than silently defaulting to simple.
4. Select provider/model/fallback policy through the model-resolution hook. Set reasoning effort only on the ephemeral per-turn run copy; restore that object reference in finally. No shared preference patch-and-restore.
5. Check the actual prepared native route, explicit profile, OAuth type, Codex harness and subscription requirement. Empty model fallbacks alone do not establish authentication or billing.
6. Before inference, recheck chosen model/effort and supply guarded current-turn metadata. Keep planned selection separate from genuine fallback accounting.
7. Correlate metadata receipts with native runtime events and delivery. A classifier result, an accepted input or a selected candidate is not proof of a completed reply.

## Administrative isolation

A native administrative RPC originally inherited custom router AsyncLocalStorage state. The prototype clears only those custom scopes inside the native authorized, scheduled administration task. The native validation, authority, approval and authentication body is preserved. Parent scopes restore afterwards; independent administration does not borrow the parent's route or recovery allowance.

## Recovery boundary

Only the exact observed native Codex execution-policy preparation error can trigger a second complete preparation, once, for the same run, session, selected model and live owner. It is refused after prompt construction, cancellation, authority revocation, a different run or independent administration. The native preparation/authorization function body is unchanged. This is not an inference retry or an exactly-once claim for arbitrary external tools.

## Reference scope

The public source uses a fictitious exact-owner DM scope and fictitious OAuth profile to reproduce the tests. It does not dynamically configure arbitrary production accounts. Historical internal identifiers such as `lab-router-6778` remain so reviewers can compare the reference with the tested implementation. Brand attribution is separate from those internal identifiers.

Native slash-command callbacks outside the reached path remain a known gap. Do not infer global interception, isolation or security guarantees from an exact-scope fixture.
