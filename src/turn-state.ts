import type { Model } from "@earendil-works/pi-ai";

export type MoaTurnState = {
  active: boolean;
  presetName: string;
  previousModel: Model<any> | undefined;
  restoreStarted: boolean;
};

let state: MoaTurnState | undefined;

export function beginMoaTurn(presetName: string, previousModel: Model<any> | undefined): void {
  state = {
    active: true,
    presetName,
    previousModel,
    restoreStarted: false,
  };
}

export function getMoaTurnState(): MoaTurnState | undefined {
  return state;
}

export function markMoaRestoreStarted(): MoaTurnState | undefined {
  if (!state || !state.active || state.restoreStarted) return undefined;
  state.restoreStarted = true;
  return state;
}

export function clearMoaTurnState(): void {
  state = undefined;
}
