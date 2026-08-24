export type WorkoutPhase = "idle" | "countdown" | "round" | "rest" | "paused" | "finished";
export type TimedPhase = "countdown" | "round" | "rest";

export function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function parseDurationDigits(value: string): number | null {
  const digits = value.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const seconds = Number(digits.slice(2));
  if (seconds > 59) return null;
  return Number(digits.slice(0, 2)) * 60 + seconds;
}

export function phaseLabel(phase: WorkoutPhase): string {
  const labels: Record<WorkoutPhase, string> = {
    idle: "Ready",
    countdown: "Get Ready",
    round: "Work",
    rest: "Rest",
    paused: "Paused",
    finished: "Workout Complete",
  };
  return labels[phase];
}

export function combinationInterval(combination: string[]): number {
  return (combination.length + 1) * 1000;
}
