import { readFileSync } from "node:fs";
import { access as accessAsync, readFile as readFileAsync } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ThinkingLevel } from "@earendil-works/pi-ai";

export type MoaModelSlot = {
  provider: string;
  model: string;
};

export type MoaReasoningLevel = "off" | ThinkingLevel;

export type MoaPreset = {
  referenceModels: MoaModelSlot[];
  aggregator: MoaModelSlot;
  referenceTemperature: number;
  aggregatorTemperature: number;
  referenceEffort: MoaReasoningLevel;
  aggregatorEffort: MoaReasoningLevel;
  maxTokens: number;
  enabled: boolean;
};

export type MoaConfig = {
  defaultPreset: string;
  presets: Record<string, MoaPreset>;
};

export const DEFAULT_PRESET_NAME = "default";

const DEFAULT_REFERENCE_MODELS: MoaModelSlot[] = [
  { provider: "openai", model: "gpt-5.2" },
  { provider: "anthropic", model: "claude-sonnet-4-5" },
];

const DEFAULT_AGGREGATOR: MoaModelSlot = {
  provider: "anthropic",
  model: "claude-sonnet-4-5",
};

export function defaultPreset(): MoaPreset {
  return {
    referenceModels: DEFAULT_REFERENCE_MODELS.map((slot) => ({ ...slot })),
    aggregator: { ...DEFAULT_AGGREGATOR },
    referenceTemperature: 0.6,
    aggregatorTemperature: 0.3,
    referenceEffort: "off",
    aggregatorEffort: "off",
    maxTokens: 4096,
    enabled: true,
  };
}

export function defaultConfig(): MoaConfig {
  return {
    defaultPreset: DEFAULT_PRESET_NAME,
    presets: {
      [DEFAULT_PRESET_NAME]: defaultPreset(),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanSlot(value: unknown): MoaModelSlot | null {
  if (!isRecord(value)) return null;
  const provider = String(value.provider ?? "").trim();
  const model = String(value.model ?? "").trim();
  if (!provider || !model) return null;
  if (provider.toLowerCase() === "moa") return null;
  return { provider, model };
}

function cleanNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function cleanReasoningLevel(value: unknown, fallback: MoaReasoningLevel): MoaReasoningLevel {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "off" || normalized === "minimal" || normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "xhigh") {
    return normalized as MoaReasoningLevel;
  }
  return fallback;
}

function normalizePreset(value: unknown): MoaPreset {
  const fallback = defaultPreset();
  if (!isRecord(value)) return fallback;

  const referenceModels = Array.isArray(value.referenceModels)
    ? value.referenceModels.map(cleanSlot).filter((slot): slot is MoaModelSlot => !!slot)
    : [];

  const aggregator = cleanSlot(value.aggregator) ?? fallback.aggregator;

  return {
    referenceModels: referenceModels.length > 0 ? referenceModels : fallback.referenceModels,
    aggregator,
    referenceTemperature: cleanNumber(value.referenceTemperature, fallback.referenceTemperature),
    aggregatorTemperature: cleanNumber(value.aggregatorTemperature, fallback.aggregatorTemperature),
    referenceEffort: cleanReasoningLevel(value.referenceEffort, fallback.referenceEffort),
    aggregatorEffort: cleanReasoningLevel(value.aggregatorEffort, fallback.aggregatorEffort),
    maxTokens: Math.max(1, Math.floor(cleanNumber(value.maxTokens, fallback.maxTokens))),
    enabled: value.enabled === undefined ? fallback.enabled : Boolean(value.enabled),
  };
}

export function normalizeConfig(value: unknown): MoaConfig {
  const fallback = defaultConfig();
  if (!isRecord(value)) return fallback;

  const presets: Record<string, MoaPreset> = {};
  if (isRecord(value.presets)) {
    for (const [name, presetValue] of Object.entries(value.presets)) {
      const cleanName = name.trim();
      if (!cleanName) continue;
      const preset = normalizePreset(presetValue);
      if (!preset.enabled) continue;
      presets[cleanName] = preset;
    }
  }

  if (Object.keys(presets).length === 0) {
    presets[fallback.defaultPreset] = fallback.presets[fallback.defaultPreset];
  }

  const requestedDefault = String(value.defaultPreset ?? "").trim();
  const defaultPresetName = presets[requestedDefault] ? requestedDefault : Object.keys(presets)[0];

  return {
    defaultPreset: defaultPresetName,
    presets,
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await accessAsync(path);
    return true;
  } catch {
    return false;
  }
}

export async function resolveConfigPath(ctx: ExtensionContext): Promise<string> {
  const projectPath = join(ctx.cwd, CONFIG_DIR_NAME, "moa.json");
  if (ctx.isProjectTrusted() && (await fileExists(projectPath))) {
    return projectPath;
  }
  return join(getAgentDir(), "moa.json");
}

export async function loadMoaConfig(ctx: ExtensionContext): Promise<{ path: string; config: MoaConfig }> {
  const path = await resolveConfigPath(ctx);
  if (!(await fileExists(path))) {
    return { path, config: defaultConfig() };
  }

  try {
    const raw = JSON.parse(await readFileAsync(path, "utf8")) as unknown;
    return { path, config: normalizeConfig(raw) };
  } catch {
    return { path, config: defaultConfig() };
  }
}

export function listPresetNames(config: MoaConfig): string[] {
  return Object.keys(config.presets);
}

export function loadGlobalMoaConfig(): MoaConfig {
  const path = join(getAgentDir(), "moa.json");
  try {
    return normalizeConfig(JSON.parse(readFileSync(path, "utf8")) as unknown);
  } catch {
    return defaultConfig();
  }
}

export function enabledPresetEntries(config: MoaConfig): Array<{ name: string; preset: MoaPreset }> {
  return Object.entries(config.presets).map(([name, preset]) => ({ name, preset }));
}

export function resolvePreset(config: MoaConfig, presetName?: string): { name: string; preset: MoaPreset } {
  const cleanName = String(presetName ?? "").trim();
  const name = cleanName && config.presets[cleanName] ? cleanName : config.defaultPreset;
  const preset = config.presets[name] ?? config.presets[config.defaultPreset] ?? defaultPreset();
  return { name, preset };
}
