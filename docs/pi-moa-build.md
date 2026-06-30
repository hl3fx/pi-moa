# Pi MoA Build Plan

Build a minimal Pi extension that mimics Hermes' Mixture of Agents as an explicit in-session command, not as a always-on selectable model provider. Start with the smallest thing that proves the idea: `/moa <task>` captures the current session context, fans the turn out to reference models in parallel, then uses one acting aggregator model to synthesize the result for that turn only.

---

## Current Status

- **Phase 1: Scaffold extension package and baseline docs** — ✅
- **Phase 2: Add MoA config schema and preset loading** — ✅
- **Phase 3: Prove model invocation path and slash-command wiring** — ✅
- **Phase 4: Implement `/moa` runtime fan-out and aggregation** — ✅
- **Phase 5: Add guardrails, smoke verification, and package polish** — ✅

### Current File Structure

```text
pi-moa/
├── docs/
│   └── pi-moa-build.md ✅
├── src/
│   ├── index.ts ✅
│   ├── config.ts ✅
│   ├── invoke.ts ✅
│   ├── runtime.ts ✅
│   └── commands.ts ✅
├── package.json ✅
├── tsconfig.json ✅
└── README.md ✅
```

## Architecture

The extension should mirror the useful MoA behavior while matching the desired Pi UX:

- `moa` is an explicit slash-command flow, not a default model/provider selection.
- `/moa <task>` promotes one turn into a higher-reasoning MoA path.
- Each MoA preset contains `referenceModels[]` and one `aggregator` model.
- Every reference model receives the full current session context plus the `/moa` task.
- Reference models are advisory only.
- The aggregator receives the same full context plus all reference outputs and produces the visible answer.
- The normal session/model remains the same before and after the `/moa` turn.

For the first pass, do not attempt Hermes-level event rendering, hidden transcript blocks, provider registration, or deep settings UI. The MVP should prove the command path and full-context orchestration first.

## Cross-Cutting Concerns — Modularity and Debugging

- Keep files by concern only: extension entry, config, invocation plumbing, runtime, commands.
- Use plain typed objects and helper functions; no class hierarchy unless Pi API forces one.
- Keep config loading in one module.
- Keep model invocation plumbing in one module.
- Keep runtime fan-out logic in one module so it is easy to test and swap.
- Use stdlib logging / conservative debug output only where it helps diagnose provider failures.
- Avoid globals except extension-local cached config if needed.
- No new dependencies unless Pi runtime already needs them.

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

## Phase 1: Scaffold extension package and baseline docs

**Status:** Done

**Why:** The extension needs a real package skeleton and a minimal file layout before any provider logic can be added.

**Outcome:** A new `pi-moa` extension folder exists with package metadata, tsconfig, entrypoint stub, and this build doc in place.

> **Context Reminder (read before starting Phase 1):**
> Keep this scaffold minimal. The lazier alternative is one giant `index.ts`, but split the files now only where they directly match the execution path: config, provider, runtime, commands.

### 1.1 Create minimal package scaffold

- [ ] **File:** `package.json`
- [ ] Add a minimal Pi package manifest with one extension entry.
- [ ] **File:** `tsconfig.json`
- [ ] Add the smallest TS config needed for the extension files.
- [ ] **File:** `src/index.ts`
- [ ] Add a minimal extension factory stub that can later register the command and runtime wiring.

### 1.2 Preserve the planning doc as source of truth

- [ ] **File:** `docs/pi-moa-build.md`
- [ ] Save this build doc and treat it as the tracked execution plan.
- [ ] **Verify:** `pi-moa/` contains `docs/`, `src/`, `package.json`, and `tsconfig.json`.

**Phase 1 Notes** *(to be filled in at end of phase — Phase 2 will read these)*
```text
package.json
- pi.extensions -> ./src/index.ts
- peerDependencies: @earendil-works/pi-ai, @earendil-works/pi-coding-agent, @earendil-works/pi-tui

tsconfig.json
- moduleResolution: Bundler
- target: ES2022

src/index.ts
- default export function(pi: ExtensionAPI)
- registers message renderer + command wiring
```

## Phase 2: Add MoA config schema and preset loading

**Status:** Done

**Why:** The command runtime needs a canonical source of preset names and model slot definitions before anything can be invoked or orchestrated.

**Outcome:** A typed config module exists that can load a default preset and normalize named presets for command-driven execution.

> **Context Reminder (read before starting Phase 2):**
> Follow the Hermes shape loosely, not literally. The MVP only needs named presets, `referenceModels[]`, `aggregator`, and a few simple runtime knobs. Skip speculative settings UI fields unless the runtime actually uses them.

### 2.1 Define the config shape

- [ ] **File:** `src/config.ts`
- [ ] Define types for provider/model slots, presets, and top-level config.
- [ ] Include a default preset shape that is valid even without user config.
- [ ] Keep field names boring and predictable.

### 2.2 Load and normalize config

- [ ] **File:** `src/config.ts`
- [ ] Add helpers to read config from a simple JSON location.
- [ ] Add normalization so missing or malformed config falls back to defaults.
- [ ] Add a helper that returns the effective preset list for command use.
- [ ] **Verify:** A no-config run can still produce at least one valid MoA preset.

**Phase 2 Notes** *(to be filled in at end of phase — Phase 3 will read these)*
```text
src/config.ts
- type MoaModelSlot = { provider: string; model: string }
- type MoaPreset = { referenceModels, aggregator, referenceTemperature, aggregatorTemperature, maxTokens, enabled }
- type MoaConfig = { defaultPreset, presets }
- loadMoaConfig(ctx)
- resolveConfigPath(ctx)
- resolvePreset(config, presetName?)
- listPresetNames(config)
- provider "moa" rejected in cleanSlot()
```

## Phase 3: Prove model invocation path and slash-command wiring

**Status:** Done

**Why:** The biggest implementation risk is not the MoA idea itself — it is proving the extension can invoke arbitrary configured provider/model pairs on demand from inside a command-driven orchestration flow.

**Outcome:** A thin `/moa` command path exists, and the extension has a verified way to invoke non-`moa` configured models for reference and aggregator use.

> **Context Reminder (read before starting Phase 3):**
> Keep this as a spike with production value. Do not build provider registration now. First prove command invocation, auth resolution, and model call plumbing.

### 3.1 Add slash-command entrypoint

- [ ] **File:** `src/commands.ts`
- [ ] Register `/moa` as the main entrypoint for command-based one-shot MoA.
- [ ] Keep command semantics explicit: `/moa <task>` applies to that turn only.
- [ ] Avoid hidden auto-trigger behavior in v1.

### 3.2 Prove model invocation plumbing

- [ ] **File:** `src/invoke.ts`
- [ ] Add the smallest helper that can invoke a configured provider/model pair.
- [ ] Verify auth/config resolution works for at least one reference-model call and one aggregator-model call.
- [ ] Keep this helper boring and reusable by the runtime.
- [ ] **Verify:** The extension can successfully invoke a real configured model from a `/moa`-driven path.

**Phase 3 Notes** *(to be filled in at end of phase — Phase 4 will read these)*
```text
src/invoke.ts
- invokeModel(ctx, slot, messages, options)
- uses ctx.modelRegistry.find(provider, model)
- uses ctx.modelRegistry.getApiKeyAndHeaders(model)
- uses complete(model, { systemPrompt, messages }, { apiKey, headers, maxTokens, temperature, signal })

src/commands.ts
- registerMoaCommands(pi)
- command names: moa, moa-presets
- parseArgs() supports --preset <name>
```

## Phase 4: Implement `/moa` runtime fan-out and aggregation

**Status:** Done

**Why:** The command is not useful until one `/moa` turn can fan out to reference models with full session context and return one synthesized result through the aggregator.

**Outcome:** `/moa <task>` captures full current session context, calls its reference models in parallel, and returns the aggregator response as the visible result for that turn.

> **Context Reminder (read before starting Phase 4):**
> Keep the runtime lean. The approved v1 behavior is full current session context to every model, parallel advisory references, one acting aggregator, no recursive MoA, and no fancy stream events.

### 4.1 Implement full-context reference-model orchestration

- [ ] **File:** `src/runtime.ts`
- [ ] Add a helper that takes the active preset, the `/moa` task, and the full current session context.
- [ ] Call each reference model in parallel with that full context.
- [ ] Treat reference outputs as advisory text only.
- [ ] Collect failures as labeled notes instead of crashing the whole run when one reference fails.

### 4.2 Implement aggregator prompt construction

- [ ] **File:** `src/runtime.ts`
- [ ] Build a private synthesis prompt that includes the same full context plus reference outputs.
- [ ] Send the final request through the preset's aggregator model.
- [ ] Make the aggregator the only acting model in the flow.

### 4.3 Connect `/moa` command to runtime

- [ ] **File:** `src/commands.ts`
- [ ] Route `/moa <task>` through the runtime using the selected/default preset.
- [ ] Return one synthesized answer into the session for that turn.
- [ ] **Verify:** A `/moa` prompt produces an answer that clearly used the reference + aggregator path.

**Phase 4 Notes** *(to be filled in at end of phase — Phase 5 will read these)*
```text
src/runtime.ts
- runMoa(ctx, presetName, preset, task)
- toBaseMessages(ctx) -> convertToLlm(ctx.sessionManager.getBranch())
- buildTaskMessage(task)
- buildAggregatorMessage(task, references)
- full current session context is fanned out to every reference and the aggregator
- references are advisory only; aggregator generates final visible answer text
```

## Phase 5: Add guardrails, smoke verification, and package polish

**Status:** Done

**Why:** The MoA path needs a few hard safety/behavior rules plus basic docs so the command is usable without turning into an expensive or recursive mess.

**Outcome:** The package has clear guardrails, a minimal README, and a smoke-testable `/moa` install/use flow.

> **Context Reminder (read before starting Phase 5):**
> Ponytail-lite means adding only the guardrails the design already requires: no recursive MoA, aggregator-only acting behavior, and simple docs. Skip settings UI and live reference rendering.

### 5.1 Add hard runtime guardrails

- [ ] **File:** `src/config.ts`
- [ ] Reject `provider: moa` in reference slots.
- [ ] Reject `provider: moa` for the aggregator slot in v1.
- [ ] Add any small caps/validation the runtime clearly needs.

### 5.2 Finish extension wiring and docs

- [ ] **File:** `src/index.ts`
- [ ] Register the `/moa` command and any tiny helper commands retained for preset discovery.
- [ ] **File:** `README.md`
- [ ] Document install, config file shape, `/moa <task>` behavior, full-context fan-out, and current MVP limitations.

### 5.3 Smoke verification

- [ ] **Verify:** The extension loads from the `pi-moa` folder without compile/import errors.
- [ ] **Verify:** `/moa <task>` runs without changing the session's default model.
- [ ] **Verify:** Each reference model receives the same full session context used for the turn.
- [ ] **Verify:** The aggregator is the only acting model in the MoA flow.
- [ ] **Verify:** README instructions match the actual file layout and config path.

**Phase 5 Notes** *(to be filled in at end of phase — Phase 6 will read these)*
```text
README.md
- documents /moa, /moa --preset <name> <task>, /moa-presets
- documents config resolution order and MVP limitations

Verification
- extension load verified with: pi -e c:/Users/td/pi-moa/src/index.ts --list-models
- file structure verified locally
- direct slash-command execution still needs interactive/runtime validation in Pi
```

---

## Key Decisions

- Implement MoA as an explicit `/moa <task>` command, not as a default selectable provider in v1.
- Keep the first pass config file-based; no settings UI required yet.
- Use named presets to match Hermes' strongest configuration idea.
- Every model in the `/moa` flow receives full current session context in v1.
- Reference models are advisory only; the aggregator is the only acting model.
- Treat reference model failures as degraded advisory input, not fatal errors.
- Reject recursive MoA (`provider: moa` inside MoA slots) in v1.
- Defer Hermes-style streamed reference reasoning blocks and provider-mode UX until after the command MVP works.

---

## Dependencies

- Pi extension API: `@earendil-works/pi-coding-agent`
- Pi AI/provider/model invocation types if needed by the command-driven runtime implementation
- TypeScript runtime already supported by Pi extension loading
- No new third-party package dependencies unless a real gap appears during implementation
- External model providers already configured in Pi for the referenced models and aggregator model

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
