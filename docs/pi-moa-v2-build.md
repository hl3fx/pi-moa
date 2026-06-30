# Pi MoA V2 Build Plan

Build the real `pi-moa` extension as a Pi-native, Hermes-faithful Mixture of Agents provider. In V2, `moa` is a registered Pi provider with named presets as models, the aggregator is the acting model for the full turn/tool loop, reference models provide advisory context before each aggregator decision, and `/moa` is convenience sugar for temporarily switching the current turn to the `moa` provider and restoring the previous model afterward.

---

## Current Status

- **Phase 1: Capture V2 architecture and preserve the prototype baseline** — ✅
- **Phase 2: Register real `moa` provider and preset-backed models** — ✅
- **Phase 3: Implement MoA provider runtime and advisory reference fan-out** — ✅
- **Phase 4: Add one-turn `/moa` switch, restore logic, and loop ownership** — ✅
- **Phase 5: Add visibility, guardrails, and verification for Hermes-faithful behavior** — ✅

### Current File Structure

```text
pi-moa/
├── docs/
│   ├── pi-moa-build.md ✅
│   └── pi-moa-v2-build.md ✅
├── src/
│   ├── index.ts ✅
│   ├── commands.ts ✅ (`/moa-presets` helper)
│   ├── config.ts ✅
│   ├── provider.ts ✅
│   ├── provider-runtime.ts ✅
│   ├── turn-switch.ts ✅
│   └── turn-state.ts ✅
├── package.json ✅
├── tsconfig.json ✅
├── README.md ✅
└── .git/ ✅
```

## Architecture

V2 follows Hermes in the strictest sense practical for Pi while remaining a Pi-native provider implementation:

- `moa` is a real Pi provider registered by the `pi-moa` extension.
- Each preset name appears as a model under provider `moa`.
- A preset contains `referenceModels[]` plus one `aggregator` model.
- Reference models are advisory only.
- The aggregator is the acting model for the entire turn, including tool calls and follow-up iterations inside that turn.
- Before each major aggregator decision, the reference panel re-runs against the current full session/tool context and provides fresh advisory outputs.
- `/moa <prompt>` is sugar that temporarily switches the current model to `moa/<preset>` for one real agent run, runs the turn under that provider, then restores the previous provider/model when the run is truly complete.
- Users may also choose `moa/<preset>` as their persistent active model/provider for a full session.
- Do **not** switch the visible main model directly to the aggregator. Switch to `moa/<preset>`; the MoA provider internally delegates acting generation and tool calls to the configured aggregator.

This replaces the prototype side-command design. The prototype proved model fan-out and aggregation mechanics, but it does not satisfy the real UX requirement because it swallows the prompt, does not make the aggregator the real acting model, and does not naturally participate in the tool loop. V2 should mimic Hermes behavior, not embed Hermes itself as a separate runtime authority.

## Cross-Cutting Concerns — Modularity and Debugging

- Keep config, provider registration, provider runtime, and turn-switch logic in separate files.
- Avoid deep class hierarchies; plain state objects and helper functions are preferred unless Pi APIs require otherwise.
- Maintain one clear source of truth for MoA turn state so restoration is reliable after success, failure, or abort.
- Preserve the prototype in git history; do not keep two installed extensions or two competing `/moa` implementations active.
- Add visible progress/status output so the user can see panel activity and aggregator progression.
- Keep the initial V2 feature set focused on Hermes-faithful behavior, not fancy desktop settings UI.
- Do not turn this into a Hermes runtime integration project; keep it as a Pi-native provider extension that reproduces the desired MoA semantics.

## Known Constraints and Design Decisions

- The existing prototype remains the baseline until V2 verification passes.
- There must only be one installed extension identity: `pi-moa`.
- Provider name remains `moa`.
- V2 should not depend on a second installed extension, a second package name, or a second extension folder.
- Recursive MoA presets are disallowed in V2.
- Every reference model should receive the full current session context in V2 because that was explicitly chosen.
- The aggregator must be the acting model, not a side-channel reviewer.
- Pi remains the host shell and tool executor; `moa` is a Pi-native provider/runtime path inside the extension, not a separate Hermes protocol/runtime embed.
- The MoA provider must forward the aggregator's assistant stream as the provider response so Pi naturally records assistant text/tool calls in the session for that turn.
- One-shot `/moa` restore must wait for the full agent run to end, not merely for the command handler, first assistant message, first tool call, or first tool result.

---

## Hermes/Pi Verification Findings

The V2 plan has been checked against local Hermes source and Pi provider APIs.

### Hermes findings to preserve

- Hermes exposes `moa` as a **virtual provider** named `Mixture of Agents`; preset names surface as models under that provider.
- Hermes `/moa` is **one-shot provider-switch sugar**: it saves the previous model/provider, sets provider `moa` and model `<preset>`, queues the prompt as a real turn, then restores the previous model after the turn.
- Hermes does **not** switch the visible main model directly to the aggregator. It switches to `moa/<preset>`; the MoA client/facade then calls the aggregator as the acting model.
- Hermes reference models are advisory-only. They receive a flattened advisory view of the conversation and no tools.
- Hermes passes the real tool list through to the aggregator call, so aggregator tool calls flow through the normal agent loop.
- Hermes refreshes references when the advisory view changes, especially after tool results; it caches only identical advisory states to avoid duplicate fan-out.
- Hermes rejects recursive MoA in aggregator slots and skips/rejects recursive MoA reference slots.

### Pi feasibility findings to preserve

- Pi extensions can register providers with `pi.registerProvider(...)`.
- `ProviderConfig` supports custom `streamSimple`, which is the right hook for a virtual `moa` provider.
- `ExtensionAPI.setModel(model)` exists and can switch to the registered `moa/<preset>` model.
- `ExtensionAPI.sendUserMessage(...)` can submit the real prompt after the temporary model switch.
- Pi has an `agent_end` event, which is the safest restore point for one-shot `/moa` because it fires after the full agent run rather than after one partial message/tool event.
- The `moa` provider should use a virtual local base URL/API key equivalent to Hermes' `moa://local` / `moa-virtual-provider` so model validation and auth checks can pass.

---

## Build Phases

> **AI BUILD RULE — read this before touching any file:**
> 1. Re-read this entire build doc before starting ANY phase.
> 2. At the START of each phase, read the "Context Reminder" block for that phase.
> 3. At the END of each phase, update the "Phase Notes" block below the checklist
>    with any class names, method signatures, field names, or decisions that the
>    next phase will need to import or depend on. Be specific — exact names only.
> 4. Before writing any import or referencing any symbol, verify it exists in an
>    already-written file using pi tools (`read`, `bash`, or a targeted shell command).
> 5. Update the **Current Status** block and the ⬜/✅ markers in **Current File
>    Structure** when a phase verifies as done.

---

## Phase 1: Capture V2 architecture and preserve the prototype baseline

**Status:** Complete

**Why:** The extension already exists as a prototype. Before rewriting internals, preserve the baseline and establish the V2 architecture clearly so implementation does not drift.

**Outcome:** The repo is initialized, the V2 plan exists, and the current prototype is treated as the explicit starting baseline for the provider-first rewrite.

> **Context Reminder (read before starting Phase 1):**
> There is one extension only: `pi-moa`. V2 is an in-place architectural rewrite, not a sibling extension. Use docs and git history to separate prototype from final direction.

### 1.1 Preserve baseline and planning artifacts

- [ ] **File:** `docs/pi-moa-v2-build.md`
- [ ] Save this V2 build doc.
- [ ] Verify the existing prototype files are present and readable as migration inputs.
- [ ] Verify the repo is initialized and current files can be tracked.

### 1.2 Record prototype shortcomings explicitly

- [ ] Add notes describing why the side-command prototype is insufficient:
  - swallowed prompt
  - result not naturally in main model flow
  - aggregator not acting as the real turn owner
  - tool loop behavior not Hermes-faithful
- [ ] **Verify:** The V2 plan states why provider-first architecture is required.

**Phase 1 Notes** *(to be filled in at end of phase — Phase 2 will read these)*
```text
Repo initialized at C:/Users/td/.pi/agent/extensions/pi-moa/.git.
V2 plan is docs/pi-moa-v2-build.md.
Prototype files were retained temporarily as migration inputs during the V2 rewrite, then removed after provider-mode verification.
Provider-first architecture is required because the prototype side command swallows the prompt and cannot own the real tool loop.
```

## Phase 2: Register real `moa` provider and preset-backed models

**Status:** Complete

**Why:** Hermes-faithful MoA requires model/provider semantics, not just a side command. Pi must see `moa` as a real provider whose models are preset names, but the implementation should stay Pi-native rather than trying to host Hermes itself.

**Outcome:** The extension registers provider `moa`, and each configured preset appears as a model under that provider.

> **Context Reminder (read before starting Phase 2):**
> This is the architectural pivot point. The provider is still extension-owned code. Do not create a second extension or external provider package.

### 2.1 Reshape config for provider-backed use

- [ ] **File:** `src/config.ts`
- [ ] Confirm preset schema supports named presets cleanly for provider registration.
- [ ] Preserve recursion guards (`provider: moa` invalid in reference or aggregator slots).
- [ ] Add any helpers needed to enumerate enabled presets for provider model registration.

### 2.2 Register provider `moa`

- [ ] **File:** `src/provider.ts`
- [ ] Add provider registration wiring with `pi.registerProvider("moa", ...)`.
- [ ] Register provider name/display as `moa` / `Mixture of Agents`.
- [ ] Use preset names as model IDs.
- [ ] Include a virtual local provider shape (`baseUrl: "moa://local"`, dummy API key equivalent to `moa-virtual-provider`) if Pi auth/model validation requires it.
- [ ] Register a custom `streamSimple` implementation that enters the MoA provider runtime.
- [ ] Expose one provider model per enabled preset name.
- [ ] Keep provider metadata simple and explicit.
- [ ] **Verify:** provider `moa` and preset-backed models are visible to Pi model selection surfaces and `ctx.modelRegistry.find("moa", presetName)` succeeds.

### 2.3 Wire provider registration into extension startup

- [ ] **File:** `src/index.ts`
- [ ] Register the provider during extension load/startup.
- [ ] Preserve existing user-facing commands only as needed during migration.
- [ ] **Verify:** loading the extension exposes provider `moa` without needing a second extension.

**Phase 2 Notes** *(to be filled in at end of phase — Phase 3 will read these)*
```text
src/provider.ts exports registerMoaProvider(pi, ctx?) and configForProvider(pi, ctx?).
Provider id is "moa" and display name is "Mixture of Agents".
Provider config uses baseUrl "moa://local", apiKey "moa-virtual-provider", api "moa", and streamSimple from createMoaStream(...).
Preset names are registered as model ids via enabledPresetEntries(config).
src/config.ts exports loadGlobalMoaConfig() and enabledPresetEntries(config).
Verified with: pi --no-extensions -e . --list-models moa -> shows moa/default.
```

## Phase 3: Implement MoA provider runtime and advisory reference fan-out

**Status:** Complete

**Why:** The provider is useless unless selecting `moa/<preset>` actually runs the MoA algorithm: references advise, aggregator acts. The runtime path should be dedicated inside Pi, not a replay of the old side-command flow.

**Outcome:** The `moa` provider runtime uses full current context, runs reference models in parallel, injects their advisory outputs, and lets the aggregator serve as the acting model.

> **Context Reminder (read before starting Phase 3):**
> Hermes behavior matters more than prototype convenience. The aggregator is the worker. References are private advisors. The runtime should support repeated advisory refreshes before each major aggregator decision inside the turn.

### 3.1 Build provider runtime entrypoint

- [ ] **File:** `src/provider-runtime.ts`
- [ ] Add the provider runtime/stream entry that Pi calls for `moa` requests, e.g. `streamMoa(model, context, options)`.
- [ ] Resolve active preset from `model.id`.
- [ ] Use Pi's `Context` as the source of truth: `systemPrompt`, `messages`, and `tools`.
- [ ] Reuse or replace the current prototype invocation helper as needed, but do not collapse the final aggregator response to plain text if it contains tool calls.

### 3.2 Implement reference advisory fan-out

- [ ] **File:** `src/provider-runtime.ts`
- [ ] Send a full advisory view of the current session context to each reference model in parallel.
- [ ] Flatten tool calls/results into text for references; do not give references the tool registry.
- [ ] Treat references as advisory only.
- [ ] Cache by advisory-view signature only to avoid duplicate fan-out for identical state; rerun references when user input or tool results change.
- [ ] Capture failures as advisory notes rather than crashing the entire provider turn when possible.
- [ ] Add visible/status progress hooks for reference activity.

### 3.3 Implement aggregator acting behavior

- [ ] **File:** `src/provider-runtime.ts`
- [ ] Build the aggregator prompt/context from full session state plus reference outputs.
- [ ] Make the aggregator the real acting model inside the `moa/<preset>` provider path.
- [ ] Forward Pi `context.tools` to the aggregator model call so aggregator-emitted tool calls become normal Pi tool calls.
- [ ] Stream the aggregator's assistant events back as the `moa` provider's assistant stream, preserving text, thinking if supported, tool calls, stop reason, and errors.
- [ ] Ensure tool calls and follow-up loop behavior stay on `moa/<preset>` while the turn is active; each subsequent provider call after a tool result should re-enter MoA and let the aggregator continue.
- [ ] **Verify:** selecting `moa/<preset>` yields a normal assistant/tool loop owned by the aggregator, with the visible model/provider still represented as `moa/<preset>`.

**Phase 3 Notes** *(to be filled in at end of phase — Phase 4 will read these)*
```text
src/provider-runtime.ts exports createMoaStream(modelRegistryOrGetter, pi?, getConfig?).
Provider runtime entrypoint returned by createMoaStream is streamMoa(model, context, options).
Reference calls use complete(model, { systemPrompt: REFERENCE_SYSTEM_PROMPT, messages }, { apiKey, headers, env, maxTokens }).
Aggregator calls use stream(aggregatorModel, aggregatorContext, { ...options, apiKey, headers, env, maxTokens }).
Aggregator stream events are remapped via remapEvent(...) so visible provider/model remains moa/<preset> while responseModel stores aggregator provider/model.
Tool calls are preserved because aggregator AssistantMessageEvent stream is forwarded instead of collapsed to text.
Reference progress side effects are intentionally disabled pending Phase 5 UI-channel decision; custom messages emitted inside provider streams polluted active context and caused runtime instability during smoke testing.
Verified direct provider smoke with: pi --no-extensions -e . --print --no-session --no-context-files --model moa/default "Say exactly: moa smoke ok" -> "moa smoke ok".
```

## Phase 4: Add one-turn `/moa` switch, restore logic, and loop ownership

**Status:** Complete

**Why:** The user wants both persistent provider selection and one-turn temporary use. `/moa` must switch into MoA for the entire turn, then restore the previous model/provider cleanly.

**Outcome:** `/moa <prompt>` temporarily switches the active model/provider to `moa/<preset>`, submits the prompt as a real user turn, lets MoA own the entire agent run/tool loop, then restores the previous model/provider after the run is complete.

> **Context Reminder (read before starting Phase 4):**
> This is not a side-channel helper anymore. `/moa` should promote the prompt into a real MoA-owned turn. Restoration timing matters: do not switch back until the MoA turn is genuinely over.

### 4.1 Track temporary turn switch state

- [ ] **File:** `src/turn-state.ts`
- [ ] Add state for previous provider/model, target preset, and whether a temporary MoA turn is active.
- [ ] Make state robust against success, failure, cancel, and abort.

### 4.2 Implement `/moa` switch command

- [ ] **File:** `src/turn-switch.ts`
- [ ] Save the current `ctx.model` as the previous model.
- [ ] Resolve the target model with `ctx.modelRegistry.find("moa", presetName)`.
- [ ] Switch to `moa/<preset>` for the pending turn via `pi.setModel(...)`.
- [ ] Deliver the prompt as a real user turn via `pi.sendUserMessage(...)` rather than swallowing it in a side command.
- [ ] Do not switch directly to the aggregator provider/model; the aggregator is internal to the `moa` provider runtime.

### 4.3 Restore previous model/provider after turn completion

- [ ] **File:** `src/turn-switch.ts`
- [ ] Hook `agent_end` or the nearest confirmed full-run lifecycle point to restore the original model only after the MoA-owned agent run finishes.
- [ ] Do not restore on command return, `message_end`, first assistant chunk, first tool call, or first tool result.
- [ ] Confirm multi-step tool loops remain under `moa/<preset>` until done.
- [ ] **Verify:** `/moa <prompt>` behaves like a one-turn provider switch, preserves the prompt/result in normal session context, then restores the original model/provider.

**Phase 4 Notes** *(to be filled in at end of phase — Phase 5 will read these)*
```text
src/turn-state.ts exports beginMoaTurn(presetName, previousModel), getMoaTurnState(), markMoaRestoreStarted(), and clearMoaTurnState().
src/turn-switch.ts exports registerMoaTurnSwitch(pi).
/moa is implemented as an input transform handler, not a registered slash command, because Pi executes registered slash commands before input transforms and command-triggered pi.sendUserMessage(...) did not produce output in --print smoke tests.
Input handler detects /moa [--preset name] <prompt>, calls pi.setModel(moaModel), records previous ctx.model, and returns { action: "transform", text: prompt } so the prompt becomes the real user turn.
Restore hook listens on agent_end and restores previous model with pi.setModel(previousModel), then clears turn state.
Verified one-shot smoke with: pi --no-extensions -e . --print --no-session --no-context-files --model openai-codex/gpt-5.4 "/moa Say exactly: moa one shot ok" -> "moa one shot ok".
```

## Phase 5: Add visibility, guardrails, and verification for Hermes-faithful behavior

**Status:** Complete

**Why:** V2 needs explicit runtime visibility and strong verification because the control flow is more complex and mistakes here will be subtle.

**Outcome:** The extension uses safe V2 visibility: normal aggregator assistant streaming plus `/moa` switch notifications, with no provider-internal context-visible progress messages. Docs, guardrails, and smoke verification are in place.

> **Context Reminder (read before starting Phase 5):**
> This phase is where the extension becomes trustworthy. Focus on proving correct behavior, not adding extra features.

### 5.1 Improve visibility

- [x] **File:** `src/index.ts`
- [x] Use safe baseline visibility for V2: `/moa` switch notification plus normal assistant streaming from the aggregator.
- [x] Do not emit provider-internal reference progress as `pi.sendMessage(...)` because custom messages are context-visible and can pollute the active turn.
- [x] Avoid noisy duplication and context pollution.

### 5.2 Update docs for real provider mode

- [x] **File:** `README.md`
- [x] Rewrite README for provider-first architecture.
- [x] Document both persistent `moa/<preset>` use and one-turn `/moa` use.
- [x] Document full-context fan-out and cost/latency tradeoffs.

### 5.3 Hermes-faithful verification

- [x] **Verify:** selecting `moa/<preset>` keeps the visible provider/model as `moa/<preset>` while making the configured aggregator the internal acting model.
- [x] **Verify:** `/moa <prompt>` uses MoA for the entire agent run/tool loop.
- [x] **Verify:** after `/moa` turn completion, the original provider/model is restored by the `agent_end` hook.
- [x] **Verify:** recursive MoA presets are rejected by config slot cleaning and provider-runtime aggregator guard.
- [x] **Verify:** reference outputs influence the aggregator but are not the visible acting model responses.
- [x] **Verify:** prompt/result are naturally part of session context because the turn is real, not swallowed.

**Phase 5 Notes** *(to be filled in at end of phase — final verification will read these)*
```text
README.md has been rewritten for provider-first MoA usage.
Prototype-only `/moa-review`, custom result/status renderers, and old `src/invoke.ts` + `src/runtime.ts` helpers were removed after V2 verification to reduce dead code and avoid confusion.
User selected Option A for V2 visibility: normal assistant streaming + /moa switch notifications only.
Provider progress via pi.sendMessage from inside streamMoa was tested and then disabled because CustomMessageEntry participates in future LLM context and early smoke tests showed instability/OOM risk when provider-internal progress was emitted as session messages.
Final verification commands:
- NODE_PATH=C:/Users/td/.pi/agent/extensions/dmecnx-pi-webui/node_modules bun -e "import('./src/index.ts').then(() => console.log('import ok')).catch(e => { console.error(e); process.exit(1); })" -> import ok
- pi --no-extensions -e . --list-models moa -> shows moa/default
- pi --no-extensions -e . --print --no-session --no-context-files --model moa/default "Say exactly: moa smoke ok" -> moa smoke ok
- pi --no-extensions -e . --print --no-session --no-context-files --model openai-codex/gpt-5.4 "/moa Say exactly: moa one shot ok" -> moa one shot ok
Non-blocking limitation: no local TypeScript compiler is installed; npx tsc attempted to fetch unsupported package `tsc@2.0.4`, so verification used Bun import and Pi smoke tests instead.
```

---

## Key Decisions

- Keep one extension identity only: `pi-moa`.
- Implement V2 in-place inside the existing extension folder.
- Register `moa` as a real provider from inside the extension.
- Use named presets as provider models.
- The selected model is `moa/<preset>`; the aggregator is the internal acting model for the whole turn/tool loop.
- Reference models are advisory only.
- `/moa` is provider-switch sugar, not the core architecture.
- `/moa` must switch to `moa/<preset>`, not directly to the aggregator model.
- Full current session context is fanned out to every reference model in V2.
- Reject recursive MoA preset composition.
- Preserve the prototype only in docs/git history, not as a second installed extension.
- Stay Pi-native: mimic Hermes behavior without turning this project into a Hermes runtime embedding effort.

---

## Dependencies

- Pi extension API: `@earendil-works/pi-coding-agent`
- Pi AI/provider APIs needed for custom provider registration and runtime streaming, especially `streamSimple`, `Context`, `AssistantMessageEventStream`, `complete`, and `stream`
- Existing Pi model registry/auth resolution for referenced models and aggregator models
- Git history in this repo for preserving and replacing the prototype cleanly
- No new third-party package dependencies unless a real provider/runtime gap appears

---

## AI Self-Check — Read This Last, Every Session

Before writing a single line of code, run through this checklist:

1. **Re-read the full build doc** — Current Status, file structure, key decisions.
2. **Find the current phase** — read its Why / Outcome / Context Reminder.
3. **Read the Phase Notes of every completed phase** — these are the ground-truth
   names for all classes, methods, and fields. Do not guess or assume.
4. **Verify imports before use** — if a symbol is referenced in new code, use
   pi tools (`read`, `bash`, or a targeted shell command) to confirm it exists
   with the expected signature.
5. **After finishing a phase** — fill in that phase's Phase Notes with exact,
   confirmed names from the files just written. Be specific: class name, method
   signature, field names, signal names. Future phases depend on this.
6. **Update Current Status + File Structure** — flip ⬜ → ✅ at the top of this
   file when a phase is verified done.
7. **Never rename a field or class mid-build** — if a change is needed, update
   the Phase Notes AND search for all existing usages before modifying.
8. **Files marked ✅ in the file structure** — do not recreate them.
