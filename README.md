# pi-moa

`pi-moa` is a Pi-native Mixture of Agents provider inspired by Hermes MoA.

It registers a virtual provider named `moa`. Each configured preset appears as a model under that provider, for example:

- `moa/default`

For a MoA turn, reference models provide private advisory context and the configured aggregator acts as the real model for the assistant response and tool calls.

## Usage

Persistent MoA session:

```bash
pi --model moa/default
```

One-shot MoA turn from another active model:

```text
/moa <prompt>
/moa --preset <name> <prompt>
```

The one-shot `/moa` path temporarily switches the active model to `moa/<preset>` for that real agent run, then restores the previous model after the run completes.

List configured presets:

```text
/moa-presets
```

## Runtime behavior

1. Pi selects `moa/<preset>` as the visible provider/model.
2. The MoA provider builds an advisory view of the current session context.
3. Reference models run in parallel without tools.
4. Reference outputs are injected as private guidance into the aggregator context.
5. The aggregator model is called with the real Pi tool list.
6. Aggregator text/tool-call events are streamed back as the `moa` provider response.
7. If tools run, the next provider call re-enters MoA with the updated context.

Important: `/moa` does **not** switch directly to the aggregator model. It switches to `moa/<preset>`; the provider internally delegates acting generation to the aggregator.

## Config

Config is JSON and loads from the first available path:

1. trusted project config: `./.pi/moa.json`
2. global config: `~/.pi/agent/moa.json`
3. built-in defaults if neither file exists

Example config:

```json
{
  "defaultPreset": "default",
  "presets": {
    "default": {
      "referenceModels": [
        { "provider": "zai", "model": "glm-5.2" },
        { "provider": "openai-codex", "model": "gpt-5.4" }
      ],
      "aggregator": { "provider": "openai-codex", "model": "gpt-5.5" },
      "referenceTemperature": 0.6,
      "aggregatorTemperature": 0.3,
      "maxTokens": 4096,
      "enabled": true
    }
  }
}
```

## Guardrails

- `provider: "moa"` is rejected inside reference or aggregator slots.
- Reference models are advisory only and do not receive tools.
- The aggregator is the internal acting model for the turn/tool loop.
- The visible selected model remains `moa/<preset>`.
- One-shot restore waits for the full agent run to end.

## Cost / latency warning

MoA fans out the current context to every reference model and then calls the aggregator. It is slower and more expensive than a normal single-model turn.
