import { formatTime, phaseLabel, type WorkoutPhase } from "./timer-utils";

interface WorkoutCardProps {
  phase: WorkoutPhase;
  currentRound: number;
  totalRounds: number;
  timerValue: number;
  phaseDuration: number;
  currentCombination: string[];
  speechWarning: string;
  onStart: () => void;
  onConfigure: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

function combinationCopy(phase: WorkoutPhase, combination: string[]): string {
  if (combination.length > 0) return combination.join("  ·  ");
  if (phase === "rest") return "Breathe. Reset. Stay ready.";
  if (phase === "countdown") return "Hands up. Find your stance.";
  if (phase === "finished") return "Strong work. Session complete.";
  return "Your next combination will appear here.";
}

export function WorkoutCard({
  phase,
  currentRound,
  totalRounds,
  timerValue,
  phaseDuration,
  currentCombination,
  speechWarning,
  onStart,
  onConfigure,
  onPause,
  onResume,
  onStop,
}: WorkoutCardProps) {
  const isRunning = phase === "countdown" || phase === "round" || phase === "rest";
  const progress = Math.min(1, Math.max(0, timerValue / (phaseDuration * 1000 || 1)));

  return (
    <section className={`timer-card phase-${phase}`} aria-labelledby="phase-heading">
      <div className="phase-row">
        <h1 className="phase-badge" id="phase-heading">
          <span aria-hidden="true" />
          {phaseLabel(phase)}
        </h1>
        <span className="round-label">
          {phase === "countdown"
            ? "Workout starting"
            : <>Round <strong>{currentRound}</strong> <span>of</span> <strong>{totalRounds}</strong></>}
        </span>
      </div>

      <div className="timer-block">
        <time className="timer" aria-live="off">{formatTime(timerValue)}</time>
        <div className="progress-track" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>

      <div className="combination-panel" aria-live="polite" aria-atomic="true">
        <p>{combinationCopy(phase, currentCombination)}</p>
      </div>

      <div className="workout-controls">
        {phase === "idle"
          ? <button className="button button-primary" type="button" onClick={onStart}>Start Workout</button>
          : null}
        {phase === "idle"
          ? <button className="button button-secondary" type="button" onClick={onConfigure}>Configure Workout</button>
          : null}
        {isRunning
          ? <button className="button button-primary" type="button" onClick={onPause}>Pause</button>
          : null}
        {phase === "paused"
          ? <button className="button button-primary" type="button" onClick={onResume}>Resume</button>
          : null}
        {isRunning || phase === "paused"
          ? <button className="button button-danger" type="button" onClick={onStop}>End Workout</button>
          : null}
        {phase === "finished"
          ? <button className="button button-primary" type="button" onClick={onStop}>Reset</button>
          : null}
      </div>

      {speechWarning ? <p className="notice" role="status">{speechWarning}</p> : null}
    </section>
  );
}
