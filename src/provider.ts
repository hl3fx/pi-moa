import type { ExtensionAPI, ExtensionContext, ModelRegistry } from "@earendil-works/pi-coding-agent";
import { enabledPresetEntries, loadGlobalMoaConfig, loadMoaConfig, type MoaConfig } from "./config";
import { createMoaStream } from "./provider-runtime";

const MOA_PROVIDER_ID = "moa";
const MOA_PROVIDER_NAME = "Mixture of Agents";
const MOA_VIRTUAL_BASE_URL = "moa://local";
const MOA_VIRTUAL_API_KEY = "moa-virtual-provider";
const MOA_CONTEXT_WINDOW = 272000;
let activeModelRegistry: ModelRegistry | undefined;

function getActiveModelRegistry(): ModelRegistry {
  if (!activeModelRegistry) throw new Error("MoA model registry is not available yet");
  return activeModelRegistry;
}

export async function configForProvider(pi: ExtensionAPI, ctx?: ExtensionContext): Promise<MoaConfig> {
  if (ctx) {
    const loaded = await loadMoaConfig(ctx);
    return loaded.config;
  }
  return loadGlobalMoaConfig();
}

export async function registerMoaProvider(pi: ExtensionAPI, ctx?: ExtensionContext): Promise<void> {
  const config = await configForProvider(pi, ctx);
  activeModelRegistry = ctx?.modelRegistry ?? pi.modelRegistry ?? activeModelRegistry;
  pi.registerProvider(MOA_PROVIDER_ID, {
    name: MOA_PROVIDER_NAME,
    baseUrl: MOA_VIRTUAL_BASE_URL,
    apiKey: MOA_VIRTUAL_API_KEY,
    api: "moa",
    streamSimple: createMoaStream(getActiveModelRegistry, pi, () => config),
    models: enabledPresetEntries(config).map(({ name, preset }) => ({
      id: name,
      name: `MoA: ${name}`,
      api: "moa",
      baseUrl: MOA_VIRTUAL_BASE_URL,
      reasoning: true,
      input: ["text"] as ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: MOA_CONTEXT_WINDOW,
      maxTokens: preset.maxTokens ?? 4096,
    })),
  });
}
