import { api } from "./client";

export interface Settings {
  crossfade_enabled: boolean;
  crossfade_seconds: number;
  whisper_model: string;
  demucs_model: string;
}

export function getSettings(): Promise<Settings> {
  return api<Settings>("/api/settings");
}

export function patchSettings(patch: Partial<Settings>): Promise<Settings> {
  return api<Settings>("/api/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
