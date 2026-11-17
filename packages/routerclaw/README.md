# RouterClaw — experimental plugin and installer

Created and directed by **Álvaro Ritter · Safety Engenharia**. [Website](https://engenharia.seg.br/) · [Instagram @seg.safety](https://www.instagram.com/seg.safety/).

RouterClaw selects model and reasoning effort for each admitted private Telegram input, keeping the conversation and respecting explicit human preferences. Simple low-risk turns use Luna/low; normal turns Sol/low; reviews and attachments Sol/high; exceptional risk, complexity or uncertainty Astra/high. The classifier adds a Luna/low call. No cost or quota saving has been measured.

**Alpha limitation:** this package requires its included development-host adapter. It supports only OpenClaw **2026.11.1** with nine exact source hashes. Installing the plugin alone leaves routing inactive. It is not a broadly compatible SDK-only plugin, an official OpenClaw feature or an upgrade of your existing OpenClaw.

## Installation

Use Node 24.22.1+ or 26.12.1+ within those major lines. Activation supports a direct Node Gateway running as a **Linux systemd user service**, under the same non-root user running this installer, using the default canonical `~/.openclaw` state directory and `~/.openclaw/openclaw.json` configuration. Non-default state/config paths, named profiles, containers, root/system services and other launchers require a separate integration; the installer refuses them. The configuration must be JSON with current keyed `agents.entries`; legacy agent lists require a separate native migration. You need one Telegram owner ID and the label of an existing OpenAI OAuth subscription profile. Never supply a password, bot token or API key to the installer.

The release `.tgz` is a normal npm package with no install hooks or runtime dependencies. To install without a registry release, use a reviewed local artifact into a private directory:

```sh
mkdir -m 700 "$HOME/routerclaw-package"
npm install --prefix "$HOME/routerclaw-package" --ignore-scripts --no-audit --no-fund /absolute/path/engritter-routerclaw-0.1.0-alpha.2.tgz
```

Use `$HOME/routerclaw-package/node_modules/.bin/routerclaw` below, or invoke `node` with the installed `bin/routerclaw.mjs`. Keep that package directory in place for as long as the prepared installation is active.

1. Run `routerclaw doctor --source /absolute/path/to/installed/openclaw`. It checks the pinned version, artifact and nine native modules, without stopping a service or calling a model.
2. Create a private JSON owner-settings file with exactly `ownerId`, `agentId`, `accountId` and `authProfileId`. Values must belong to your existing setup. `authProfileId` is a profile **label**, not a credential. Use file mode `600`.
3. Choose a new installation directory under an existing private parent, separate from OpenClaw's software directory, this package and its configuration directory. Allow disk space for a copy of the installed OpenClaw software.
4. Prepare:

```sh
routerclaw prepare --source /absolute/path/to/installed/openclaw \
  --config /absolute/path/to/openclaw.json \
  --destination /private/existing-parent/new-installation \
  --owner-settings /private/owner-settings.json
```

Preparation copies software and writes a proposed configuration under a directory with mode `700`; it changes no running service. It does not copy credential stores, conversation databases, memory or workspaces. **The private proposed configuration and activation backup can contain existing inline secrets from your original configuration.** Keep the installation directory private; never publish it or attach it to an issue.

5. Activate explicitly, as the user who owns the Gateway:

```sh
routerclaw activate --installation /private/existing-parent/new-installation
```

The installer validates the proposed configuration, verifies the current service and config, requests native draining, requires zero active work and no blockers/write custody, then stops the original service. It keeps a private recovery copy, merges settings only for RouterClaw, installs a service override selecting the separate candidate, starts the service and checks the actual process and native health. A failed new start/health check restores the unchanged prior configuration and service. Concurrent edits cause refusal; they are not overwritten. Nothing erases conversations, auth profiles, network settings or other agents.

An earlier `lab-router-6778` development deployment must be migrated separately; this installer refuses to layer itself over it. Existing manual model/effort pins are preserved and can cause routed requests to refuse until the owner resolves them directly. The alpha uses the existing Codex subscription route; it does not provision or renew accounts.

## Verify activation

`routerclaw status --installation /private/existing-parent/new-installation` verifies the prepared adapter and reads its recorded lifecycle state. A successful activation reports **`active-awaiting-real-message`**, not a proven live router. This is not a substitute for a fresh health query.

Send a new private Telegram message from the configured owner. Check one classification, planned model/effort, actual completed execution model, prepared OAuth route and delivered reply. Test a normal request, review, exceptional task and queued follow-up. Keep only metadata in evidence; do not publish raw chats. The package does not synthesize human Telegram inputs or message other bots.

The production prototype's historical tests do not establish a fresh installation's behavior. The native `/status` command gap, broad-media coverage gap, original preparation-race uncertainty and post-terminal context-snapshot warnings remain. No automatic medium-effort role is used. A simple attachment alone does not force Astra.

## Return to the original installation

```sh
routerclaw rollback --installation /private/existing-parent/new-installation
```

Return requires the installed configuration and RouterClaw override to match the recorded changes. It drains first, restores the saved prior configuration, removes only its own unchanged override and starts the prior service. Later user edits are preserved through refusal, so review and reconcile them before a manual recovery. Reports remain in `activation/state.json`. No histories or software installations are deleted.

## Build and evidence

From the source repository, run `python3 scripts/build_reference.py`, then `node scripts/build-routerclaw.mjs`, `node --test test/*.test.mjs` and `node scripts/check-public.mjs`. Run `npm pack` inside `packages/routerclaw`; the prepack check refuses an incomplete or changed adapter. Source and test fixtures are maintained separately from the generated release adapter.

The previous prototype has 47 isolated cases and four recent real Telegram turns, plus eight earlier turns under a prior policy. Installer fixtures and install-smoke evidence are recorded separately; synthetic lifecycle tests are not production or real-message proof. The source repository is public. This source version has no published ClawHub release. The earlier staged artifact was withdrawn for attribution privacy.

MIT for original contributions; OpenClaw portions retain their own MIT notice in `adapter/OPENCLAW-LICENSE`. This project is independent of, and not endorsed by, the OpenClaw Foundation. The installation does not grant permissions beyond the operator's existing account; explicit activation grants conversation and prompt hooks only to this plugin.

The public alpha.2 source changes branding, repository links and private agent attribution. The native installation/rollback artifact evidence remains explicitly attached to alpha.1; it is not presented as a new exact-byte native installation test of alpha.2. The public source is tested again by CI.
