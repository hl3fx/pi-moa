import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadMoaConfig, resolvePreset } from "./config";
import { beginMoaTurn, clearMoaTurnState, markMoaRestoreStarted } from "./turn-state";

function parseMoaInput(input: string): { matched: boolean; presetName?: string; prompt: string } {
  const trimmed = input.trim();
  if (trimmed !== "/moa" && !trimmed.startsWith("/moa ")) return { matched: false, prompt: input };
  const rest = trimmed.slice(4).trim();
  const presetMatch = rest.match(/^--preset\s+(\S+)\s+([\s\S]+)$/);
  if (presetMatch) {
    return { matched: true, presetName: presetMatch[1], prompt: presetMatch[2].trim() };
  }
  return { matched: true, prompt: rest };
}

async function switchNextInputToMoa(text: string, ctx: ExtensionContext, pi: ExtensionAPI): Promise<{ action: "continue" } | { action: "handled" } | { action: "transform"; text: string }> {
  const parsed = parseMoaInput(text);
  if (!parsed.matched) return { action: "continue" };

  if (!parsed.prompt) {
    ctx.ui.notify("Usage: /moa [--preset name] <prompt>", "warning");
    return { action: "handled" };
  }

  if (!ctx.isIdle()) {
    ctx.ui.notify("/moa one-shot switching is only supported when the agent is idle.", "warning");
    return { action: "handled" };
  }

  const { config } = await loadMoaConfig(ctx);
  const { name: presetName } = resolvePreset(config, parsed.presetName);
  const moaModel = ctx.modelRegistry.find("moa", presetName);
  if (!moaModel) {
    ctx.ui.notify(`MoA preset model not registered: moa/${presetName}. Try /reload, then retry.`, "error");
    return { action: "handled" };
  }

  const previousModel = ctx.model;
  const switched = await pi.setModel(moaModel);
  if (!switched) {
    ctx.ui.notify(`Could not switch to moa/${presetName}; check MoA provider registration/auth.`, "error");
    return { action: "handled" };
  }

  beginMoaTurn(presetName, previousModel);
  ctx.ui.notify(`MoA one-shot using preset ${presetName}; previous model will be restored after this run.`, "info");
  return { action: "transform", text: parsed.prompt };
}

export function registerMoaTurnSwitch(pi: ExtensionAPI): void {
  pi.on("input", async (event, ctx) => {
    if (event.source !== "interactive" && event.source !== "rpc" && event.source !== "extension") {
      return { action: "continue" as const };
    }
    return switchNextInputToMoa(event.text, ctx, pi);
  });

  pi.on("agent_end", async (_event, _ctx) => {
    const state = markMoaRestoreStarted();
    if (!state) return;
    try {
      if (state.previousModel) {
        await pi.setModel(state.previousModel);
      }
    } finally {
      clearMoaTurnState();
    }
  });
}
