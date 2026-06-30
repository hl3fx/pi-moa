import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerMoaCommands } from "./commands";
import { registerMoaProvider } from "./provider";
import { registerMoaTurnSwitch } from "./turn-switch";

export default async function (pi: ExtensionAPI) {
  await registerMoaProvider(pi);
  pi.on("session_start", async (_event, ctx) => {
    await registerMoaProvider(pi, ctx);
  });
  registerMoaTurnSwitch(pi);
  registerMoaCommands(pi);
}
