# pi-moa

`pi-moa` is a Pi-native Mixture of Agents provider inspired by Hermes MoA.

It registers a virtual provider named `moa`, so presets show up as models like:

- `moa/default`

For a MoA turn:
- reference models provide private advisory context
- the configured aggregator is the real acting model
- tool calls stay in the normal Pi loop

## Status

Built for my own use.

I did **not** sit down and carefully review the code line by line. I had Pi build it for my purposes, tested that it works for me, and kept going.

So:
- use at your own risk
- expect rough edges
- if you want it better, fork it

I am **not** looking to manage PRs. If people want to improve it, do the normal fork / adapt / publish-your-own-thing flow. If you make a better one, I'll probably use yours.

## What it does

### Persistent MoA session

```bash
pi --model moa/default
```

### One-shot MoA turn

```text
/moa <prompt>
/moa --preset <name> <prompt>
```

`/moa` temporarily switches the active model to `moa/<preset>` for that real run, then restores the previous model after the run completes.

### List presets

```text
/moa-presets
```

## Runtime shape

1. Pi selects `moa/<preset>` as the visible model.
2. Reference models run in parallel without tools.
3. Their outputs are injected as private guidance.
4. The aggregator runs as the internal acting model.
5. Aggregator text/tool-call events are streamed back as the `moa` provider response.
6. If tools run, the provider re-enters MoA on the next call with updated context.

Important: `/moa` does **not** switch directly to the aggregator model. It switches to `moa/<preset>`.

## Config

Config loads from the first available path:

1. trusted project config: `./.pi/moa.json`
2. global config: `~/.pi/agent/moa.json`
3. built-in defaults

Example:

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

- `provider: "moa"` is rejected inside reference or aggregator slots
- reference models are advisory only and get no tools
- the aggregator is the internal acting model for the full turn/tool loop
- the visible selected model remains `moa/<preset>`
- one-shot restore waits for full `agent_end`

## Cost / latency

MoA fans out current context to multiple models and then runs an aggregator. It is slower and more expensive than a normal single-model turn.
