import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { listPresetNames, loadMoaConfig } from "./config";

export function registerMoaCommands(pi: ExtensionAPI): void {
  pi.registerCommand("moa-presets", {
    description: "List configured MoA presets",
    handler: async (_args, ctx) => {
      const { config } = await loadMoaConfig(ctx);
      const presets = listPresetNames(config);
      const message = presets.length > 0 ? `MoA presets: ${presets.join(", ")}` : "No MoA presets configured.";
      ctx.ui.notify(message, "info");
    },
  });
}
