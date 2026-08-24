export const PRESETS = {
  "Boxing Basics": [
    "Jab;Cross",
    "Jab;Jab;Cross",
    "Jab;Cross;Left Hook",
    "Cross;Left Hook;Cross",
    "Jab;Right Uppercut;Left Hook",
    "Jab;Cross;Left Hook;Cross",
  ],
  "Boxing Combinations": [
    "Jab;Cross;Left Hook;Cross",
    "Jab;Jab;Cross;Left Hook",
    "Cross;Left Hook;Right Uppercut;Left Hook",
    "Jab;Right Uppercut;Left Hook;Cross",
    "Jab;Cross;Left Uppercut;Right Hook",
    "Jab;Cross;Left Hook;Right Hook;Cross",
    "Left Uppercut;Right Uppercut;Left Hook;Cross",
  ],
  "Defense & Counters": [
    "Jab;Slip Right;Cross",
    "Cross;Slip Left;Left Hook",
    "Jab;Cross;Roll;Left Hook",
    "Slip Left;Cross;Left Hook;Cross",
    "Slip Right;Left Hook;Cross",
    "Jab;Roll;Right Hook;Left Hook",
  ],
  Kickboxing: [
    "Jab;Cross;Right Kick",
    "Jab;Left Kick",
    "Cross;Left Hook;Right Kick",
    "Jab;Cross;Left Hook;Left Kick",
    "Lead Teep;Cross;Left Hook",
    "Jab;Right Kick;Cross;Left Kick",
    "Lead Teep;Rear Teep;Cross",
  ],
  "Muay Thai": [
    "Jab;Cross;Right Knee",
    "Lead Teep;Cross;Left Knee",
    "Jab;Right Elbow;Left Knee",
    "Cross;Left Hook;Right Kick",
    "Jab;Cross;Left Knee;Right Knee",
    "Rear Teep;Jab;Cross;Right Kick",
    "Left Elbow;Right Elbow;Left Knee",
  ],
} as const;

export type PresetName = keyof typeof PRESETS | "Custom";
export type Theme = "light" | "dark";

export interface WorkoutSettings {
  rounds: number;
  prepareDuration: number;
  roundDuration: number;
  restDuration: number;
  combinationsText: string;
  preset: PresetName;
  randomize: boolean;
  voiceRate: number;
  theme: Theme;
}

export interface SettingsErrors {
  rounds?: string;
  prepareDuration?: string;
  roundDuration?: string;
  restDuration?: string;
  combinations?: string;
}

export const DEFAULT_SETTINGS: WorkoutSettings = {
  rounds: 3,
  prepareDuration: 30,
  roundDuration: 180,
  restDuration: 60,
  combinationsText: PRESETS["Boxing Basics"].join("\n"),
  preset: "Boxing Basics",
  randomize: true,
  voiceRate: 1,
  theme: "light",
};

const STORAGE_KEY = "corner-bell-settings-v1";

export function parseCombinations(value: string): string[][] {
  return value
    .split("\n")
    .map((line) => line.split(";").map((strike) => strike.trim()).filter(Boolean))
    .filter((combination) => combination.length > 0);
}

export function validateSettings(settings: WorkoutSettings): SettingsErrors {
  const errors: SettingsErrors = {};
  if (!Number.isInteger(settings.rounds) || settings.rounds < 1)
    errors.rounds = "Enter at least 1 round.";
  if (!Number.isInteger(settings.prepareDuration) || settings.prepareDuration < 0)
    errors.prepareDuration = "Enter time as mm:ss.";
  if (!Number.isInteger(settings.roundDuration) || settings.roundDuration < 1)
    errors.roundDuration = "Enter time as mm:ss (at least 00:01).";
  if (!Number.isInteger(settings.restDuration) || settings.restDuration < 0)
    errors.restDuration = "Enter time as mm:ss.";
  if (parseCombinations(settings.combinationsText).length === 0)
    errors.combinations = "Add at least one valid combination.";
  return errors;
}

export function isPresetName(value: unknown): value is PresetName {
  return value === "Custom" || (typeof value === "string" && value in PRESETS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function hasStoredSettings(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function loadSettings(): WorkoutSettings {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!isRecord(stored)) return DEFAULT_SETTINGS;
    const candidate: WorkoutSettings = {
      rounds: typeof stored.rounds === "number" ? stored.rounds : DEFAULT_SETTINGS.rounds,
      prepareDuration: typeof stored.prepareDuration === "number" ? stored.prepareDuration : DEFAULT_SETTINGS.prepareDuration,
      roundDuration: typeof stored.roundDuration === "number" ? stored.roundDuration : DEFAULT_SETTINGS.roundDuration,
      restDuration: typeof stored.restDuration === "number" ? stored.restDuration : DEFAULT_SETTINGS.restDuration,
      combinationsText: typeof stored.combinationsText === "string" ? stored.combinationsText : DEFAULT_SETTINGS.combinationsText,
      preset: isPresetName(stored.preset) ? stored.preset : "Custom",
      randomize: typeof stored.randomize === "boolean" ? stored.randomize : DEFAULT_SETTINGS.randomize,
      voiceRate: typeof stored.voiceRate === "number" ? stored.voiceRate : DEFAULT_SETTINGS.voiceRate,
      theme: stored.theme === "dark" ? "dark" : "light",
    };
    return Object.keys(validateSettings(candidate)).length === 0 ? candidate : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function persistSettings(settings: WorkoutSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Settings persistence is optional; the timer still works without it.
  }
}
