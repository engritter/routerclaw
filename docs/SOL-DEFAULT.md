# Sol by default; Astra for exceptional cases

Author-approved policy applied on 2026-11-16. This is a usage preference motivated by the author's experience of consumption, not a measured universal price or capability ranking.

| Input classification | Model | Effort |
|---|---|---|
| Simple, low-risk, confident; no attachment | gpt-6-luna | low |
| Normal, low-risk, confident | gpt-6-sol | low |
| Review, medium risk, or attachment alone | gpt-6-sol | high |
| Complex/unknown kind, high/unknown risk, or confidence below 0.85 | gpt-6-astra | high |

Exceptional conditions take precedence over the attachment floor. No automatic medium-effort role remains. Explicit human preferences are still respected through refusal of conflicts. The Luna/low classifier and its 45-second deadline are unchanged. No account permissions, authentication, native authorization checks, global defaults or other agents were broadened.

## Qualification and promotion

The 47 isolated tests include the previous 41 and six additional policy cases. They cover normal and review decisions, media/medium-risk floors, exceptional precedence, the absence of automatic medium effort, queued admitted execution and the extracted native idle dispatcher. Twelve modules passed syntax checks. Only the decision helper changed in the runtime overlay; the existing native wiring remained byte-identical to the previous revision.

The service was drained with no active runs or blockers before its normal stop/start. Previous outputs, configuration and unit were preserved for return. Configuration and service-unit hashes remained unchanged, health passed and the native Codex plugin remained trusted-official.

## Real Telegram validation of this policy

| Case | Scenario | Classification and selection | Verified result |
|---|---|---|---|
| SD01 | Short greeting | LEVE/low → Luna/low | Native execution succeeded; reply observed |
| SD02 | Synthetic concurrency/idempotency reasoning | REVISAO/high risk → Astra/high | Native execution succeeded; reply observed |
| SD03 | Ordinary drafting request sent while SD02 was active | NORMAL/low → Sol/low | Separate classified turn completed; reply observed |
| SD04 | Pseudocode review and read-only administration query | REVISAO/low → Sol/high | OpenClaw tool succeeded; execution and delivery succeeded |

Each input had exactly one recorded classification. Native completed-model records matched the selected model; the message-delivery tool succeeded and the four replies were observed in Telegram Desktop. The same conversation was preserved. See the [redacted ledger](../evidence/sol-default-policy.json).

The attachment floor was verified offline in this revision, without a new live attachment test. The earlier live TXT test remains historical evidence under the older mapping. Native `/status` coverage, context-snapshot warnings, broad media coverage, production timeout stress and the unproven original preparation-race cause remain as documented in [validation limits](VALIDATION.md). There is no measured saving, production-reliability certification or claim that Astra is the lowest-quality model.
