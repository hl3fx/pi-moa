import { complete, createAssistantMessageEventStream, stream, type AssistantMessage, type AssistantMessageEvent, type AssistantMessageEventStream, type Context, type Message, type Model, type SimpleStreamOptions, type TextContent, type ToolCall, type ToolResultMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ModelRegistry } from "@earendil-works/pi-coding-agent";
import type { MoaModelSlot, MoaPreset } from "./config";
import { loadGlobalMoaConfig, resolvePreset, type MoaConfig } from "./config";

const REFERENCE_TOOL_RESULT_BUDGET = 4000;

const REFERENCE_SYSTEM_PROMPT = `You are a reference advisor in a Mixture of Agents (MoA) process. You are NOT the acting agent and you do NOT execute anything: you cannot call tools, run commands, browse, or access files, repositories, or URLs, and you should not try to or apologize for being unable to.

The conversation below is the current state of a task handled by the acting aggregator. Give concise private guidance: best approach, concrete next steps, tool-use strategy, likely pitfalls, disagreements, and anything the acting model may miss. Respond with advice only.`;

export type MoaProgressEvent =
  | { type: "reference"; presetName: string; index: number; count: number; label: string; text: string }
  | { type: "aggregating"; presetName: string; aggregator: string; refCount: number };

type ReferenceOutput = { label: string; text: string };

type StreamMoaOptions = SimpleStreamOptions & {
  onProgress?: (event: MoaProgressEvent) => void;
};

const referenceCache = new Map<string, ReferenceOutput[]>();

function emptyUsage(): AssistantMessage["usage"] {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function createErrorMessage(model: Model<any>, error: unknown): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text: `MoA provider error: ${error instanceof Error ? error.message : String(error)}` }],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: emptyUsage(),
    stopReason: "error",
    errorMessage: error instanceof Error ? error.message : String(error),
    timestamp: Date.now(),
  };
}

function slotLabel(slot: MoaModelSlot): string {
  return `${slot.provider}/${slot.model}`;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const block = part as Partial<TextContent> & { thinking?: string; name?: string; arguments?: unknown };
    if (typeof block.text === "string") parts.push(block.text);
    else if (typeof block.thinking === "string") parts.push(block.thinking);
  }
  return parts.join("\n");
}

function renderToolCall(call: ToolCall): string {
  let args = "";
  try {
    args = JSON.stringify(call.arguments ?? {});
  } catch {
    args = String(call.arguments ?? "");
  }
  return `[called tool: ${call.name}(${args})]`;
}

function truncateToolResult(text: string): string {
  if (text.length <= REFERENCE_TOOL_RESULT_BUDGET) return text;
  const half = Math.floor(REFERENCE_TOOL_RESULT_BUDGET / 2);
  const omitted = text.length - half * 2;
  return `${text.slice(0, half)}\n[... ${omitted} chars omitted ...]\n${text.slice(-half)}`;
}

function buildReferenceMessages(context: Context): Message[] {
  const rendered: Message[] = [];
  for (const message of context.messages) {
    if (message.role === "user") {
      rendered.push({ role: "user", content: message.content, timestamp: message.timestamp });
      continue;
    }

    if (message.role === "assistant") {
      const parts: string[] = [];
      const text = textFromContent(message.content).trim();
      if (text) parts.push(text);
      for (const block of message.content) {
        if (block.type === "toolCall") parts.push(renderToolCall(block));
      }
      if (parts.length) {
        rendered.push({ role: "assistant", content: [{ type: "text", text: parts.join("\n") }], timestamp: message.timestamp, api: message.api, provider: message.provider, model: message.model, usage: message.usage, stopReason: message.stopReason });
      }
      continue;
    }

    if (message.role === "toolResult") {
      const blockText = `[tool result: ${message.toolName} ${message.isError ? "(error)" : ""}\n${truncateToolResult(textFromContent(message.content))}]`;
      const previous = rendered[rendered.length - 1];
      if (previous?.role === "assistant") {
        previous.content = [{ type: "text", text: `${textFromContent(previous.content)}\n${blockText}` }];
      } else {
        rendered.push(referenceAssistantMessage(blockText, message));
      }
    }
  }

  if (rendered[rendered.length - 1]?.role === "assistant") {
    rendered.push({ role: "user", content: [{ type: "text", text: "Give advisory guidance on the current task state above." }], timestamp: Date.now() });
  }
  return rendered;
}

function referenceAssistantMessage(text: string, source?: ToolResultMessage): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "moa-reference-view",
    provider: "moa",
    model: "reference-view",
    usage: emptyUsage(),
    stopReason: "stop",
    timestamp: source?.timestamp ?? Date.now(),
  };
}

function cacheKey(presetName: string, preset: MoaPreset, messages: Message[]): string {
  return JSON.stringify({
    presetName,
    refs: preset.referenceModels.map(slotLabel),
    messages: messages.map((message) => ({ role: message.role, text: textFromContent(message.content) })),
  });
}

async function getModelAuth(modelRegistry: ModelRegistry, slot: MoaModelSlot) {
  const model = modelRegistry.find(slot.provider, slot.model);
  if (!model) throw new Error(`Model not found: ${slotLabel(slot)}`);
  const auth = await modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) throw new Error(auth.error);
  return { model, auth };
}

async function runReference(modelRegistry: ModelRegistry, slot: MoaModelSlot, messages: Message[], preset: MoaPreset): Promise<ReferenceOutput> {
  try {
    const { model, auth } = await getModelAuth(modelRegistry, slot);
    const result = await complete(
      model,
      { systemPrompt: REFERENCE_SYSTEM_PROMPT, messages },
      { apiKey: auth.apiKey, headers: auth.headers, env: auth.env, maxTokens: preset.maxTokens },
    );
    const text = textFromContent(result.content).trim() || `[empty response; stop reason: ${result.stopReason}]`;
    return { label: slotLabel(slot), text };
  } catch (error) {
    return { label: slotLabel(slot), text: `[failed: ${error instanceof Error ? error.message : String(error)}]` };
  }
}

async function runReferences(modelRegistry: ModelRegistry, presetName: string, preset: MoaPreset, context: Context, onProgress?: (event: MoaProgressEvent) => void): Promise<ReferenceOutput[]> {
  if (!preset.enabled || preset.referenceModels.length === 0) return [];
  const refMessages = buildReferenceMessages(context);
  const key = cacheKey(presetName, preset, refMessages);
  const cached = referenceCache.get(key);
  if (cached) return cached;

  const outputs = await Promise.all(preset.referenceModels.map((slot) => runReference(modelRegistry, slot, refMessages, preset)));
  referenceCache.set(key, outputs);
  outputs.forEach((output, index) => onProgress?.({ type: "reference", presetName, index: index + 1, count: outputs.length, label: output.label, text: output.text }));
  return outputs;
}

function buildAggregatorContext(context: Context, presetName: string, preset: MoaPreset, references: ReferenceOutput[]): Context {
  if (references.length === 0) return context;
  const joined = references.map((reference, index) => `Reference ${index + 1} — ${reference.label}:\n${reference.text}`).join("\n\n---\n\n");
  const guidance = `[Mixture of Agents reference context]\nPreset: ${presetName}\nAggregator/acting model: ${slotLabel(preset.aggregator)}\nReferences: ${references.map((reference) => reference.label).join(", ")}\n\nUse the reference responses below as private context. You are the aggregator and acting model: answer the user directly or call tools as needed.\n\n${joined}`;
  const messages = [...context.messages];
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role === "user") {
      const base = textFromContent(message.content);
      messages[index] = { ...message, content: [{ type: "text", text: `${base}\n\n${guidance}` }] };
      return { ...context, messages };
    }
  }
  messages.push({ role: "user", content: [{ type: "text", text: guidance }], timestamp: Date.now() });
  return { ...context, messages };
}

function remapMessage(message: AssistantMessage, virtualModel: Model<any>, aggregator: MoaModelSlot): AssistantMessage {
  return {
    ...message,
    provider: virtualModel.provider,
    model: virtualModel.id,
    responseModel: `${aggregator.provider}/${aggregator.model}`,
  };
}

function remapEvent(event: AssistantMessageEvent, virtualModel: Model<any>, aggregator: MoaModelSlot): AssistantMessageEvent {
  if ("partial" in event) {
    return { ...event, partial: remapMessage(event.partial, virtualModel, aggregator) } as AssistantMessageEvent;
  }
  if (event.type === "done") {
    return { ...event, message: remapMessage(event.message, virtualModel, aggregator) };
  }
  if (event.type === "error") {
    return { ...event, error: remapMessage(event.error, virtualModel, aggregator) };
  }
  return event;
}

export function createMoaStream(modelRegistry: ModelRegistry | (() => ModelRegistry), pi?: ExtensionAPI, getConfig: () => MoaConfig = loadGlobalMoaConfig) {
  const getModelRegistry = typeof modelRegistry === "function" ? modelRegistry : () => modelRegistry;
  return function streamMoa(model: Model<any>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream {
    const streamOut = createAssistantMessageEventStream();

    (async () => {
      try {
        const { name: presetName, preset } = resolvePreset(getConfig(), model.id);
        if (preset.aggregator.provider.toLowerCase() === "moa") {
          throw new Error("MoA aggregator cannot be another MoA preset");
        }

        const progress = (_event: MoaProgressEvent) => {
          // Keep provider-runtime progress side-effect free for now. Pi custom
          // messages participate in session context, so emitting them from
          // inside the provider stream risks feeding MoA telemetry back into
          // the active turn. Phase 5 can add a non-context UI channel if Pi
          // exposes one for provider streams.
          void pi;
        };

        const activeModelRegistry = getModelRegistry();
        const references = await runReferences(activeModelRegistry, presetName, preset, context, progress);
        if (references.length > 0) progress({ type: "aggregating", presetName, aggregator: slotLabel(preset.aggregator), refCount: references.length });

        const { model: aggregatorModel, auth } = await getModelAuth(activeModelRegistry, preset.aggregator);
        const aggregatorContext = buildAggregatorContext(context, presetName, preset, references);
        const aggregatorStream = stream(aggregatorModel, aggregatorContext, {
          ...options,
          apiKey: auth.apiKey,
          headers: auth.headers,
          env: auth.env,
          maxTokens: options?.maxTokens ?? preset.maxTokens,
        });

        for await (const event of aggregatorStream) {
          streamOut.push(remapEvent(event, model, preset.aggregator));
        }
        streamOut.end(remapMessage(await aggregatorStream.result(), model, preset.aggregator));
      } catch (error) {
        const message = createErrorMessage(model, error);
        streamOut.push({ type: "error", reason: "error", error: message });
        streamOut.end(message);
      }
    })();

    return streamOut;
  };
}
