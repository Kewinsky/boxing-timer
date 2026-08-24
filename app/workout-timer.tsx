"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

type WorkoutPhase = "idle" | "countdown" | "round" | "rest" | "paused" | "finished";
type TimedPhase = "countdown" | "round" | "rest";
type PresetName = keyof typeof PRESETS | "Custom";
type Theme = "light" | "dark";

interface WorkoutSettings {
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

interface SettingsErrors {
  rounds?: string;
  prepareDuration?: string;
  roundDuration?: string;
  restDuration?: string;
  combinations?: string;
}

interface DurationFieldProps {
  id: string;
  label: string;
  value: number;
  error?: string;
  onChange: (value: number) => void;
}

const PRESETS = {
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

const DEFAULT_SETTINGS: WorkoutSettings = {
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

function parseCombinations(value: string): string[][] {
  return value
    .split("\n")
    .map((line) => line.split(";").map((strike) => strike.trim()).filter(Boolean))
    .filter((combination) => combination.length > 0);
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(totalSeconds / 60).toString().padStart(2, "0")}:${(totalSeconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

function parseDurationDigits(value: string): number | null {
  const digits = value.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const seconds = Number(digits.slice(2));
  if (seconds > 59) return null;
  return Number(digits.slice(0, 2)) * 60 + seconds;
}

function validateSettings(settings: WorkoutSettings): SettingsErrors {
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

function isPresetName(value: unknown): value is PresetName {
  return value === "Custom" || (typeof value === "string" && value in PRESETS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function loadSettings(): WorkoutSettings {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!isRecord(stored)) return DEFAULT_SETTINGS;
    const value = stored;
    const candidate: WorkoutSettings = {
      rounds: typeof value.rounds === "number" ? value.rounds : DEFAULT_SETTINGS.rounds,
      prepareDuration: typeof value.prepareDuration === "number" ? value.prepareDuration : DEFAULT_SETTINGS.prepareDuration,
      roundDuration: typeof value.roundDuration === "number" ? value.roundDuration : DEFAULT_SETTINGS.roundDuration,
      restDuration: typeof value.restDuration === "number" ? value.restDuration : DEFAULT_SETTINGS.restDuration,
      combinationsText: typeof value.combinationsText === "string" ? value.combinationsText : DEFAULT_SETTINGS.combinationsText,
      preset: isPresetName(value.preset) ? value.preset : "Custom",
      randomize: typeof value.randomize === "boolean" ? value.randomize : DEFAULT_SETTINGS.randomize,
      voiceRate: typeof value.voiceRate === "number" ? value.voiceRate : DEFAULT_SETTINGS.voiceRate,
      theme: value.theme === "dark" ? "dark" : "light",
    };
    return Object.keys(validateSettings(candidate)).length === 0 ? candidate : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];
  const allVoices = window.speechSynthesis.getVoices();
  const englishVoices = allVoices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  return englishVoices.length > 0 ? englishVoices : allVoices;
}

function phaseLabel(phase: WorkoutPhase): string {
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

function combinationInterval(combination: string[]): number {
  return (combination.length + 1) * 1000;
}

function selectZeroValue(event: FocusEvent<HTMLInputElement>) {
  if (event.currentTarget.value === "0") event.currentTarget.select();
}

function DurationField({ id, label, value, error, onChange }: DurationFieldProps) {
  const formattedValue = formatTime(value * 1000);

  function commitDigits(digits: string, input: HTMLInputElement) {
    const nextValue = parseDurationDigits(digits);
    if (nextValue === null) {
      input.value = formattedValue;
      return;
    }
    const nextFormattedValue = formatTime(nextValue * 1000);
    input.value = nextFormattedValue;
    input.setSelectionRange(nextFormattedValue.length, nextFormattedValue.length);
    onChange(nextValue);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const isFullySelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
    const currentDigits = isFullySelected ? "" : formattedValue.replace(":", "");

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      commitDigits(currentDigits + event.key, input);
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      commitDigits(isFullySelected ? "" : currentDigits.slice(0, -1), input);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)
      event.preventDefault();
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    commitDigits(event.currentTarget.value, event.currentTarget);
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const input = event.currentTarget;
    const pastedDigits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pastedDigits) {
      input.value = formattedValue;
      return;
    }
    const isFullySelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
    const currentDigits = isFullySelected ? "" : formattedValue.replace(":", "");
    commitDigits(currentDigits + pastedDigits, input);
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="duration-input" type="text" inputMode="numeric"
        pattern="[0-9]{2}:[0-5][0-9]"
        value={formattedValue} onFocus={(event) => event.currentTarget.select()}
        onKeyDown={handleKeyDown} onChange={handleChange} onPaste={handlePaste}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)} />
      {error ? <p className="field-error" id={`${id}-error`} role="alert">{error}</p> : null}
    </div>
  );
}

export function WorkoutTimer() {
  const [settings, setSettings] = useState<WorkoutSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<WorkoutSettings>(DEFAULT_SETTINGS);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [phase, setPhase] = useState<WorkoutPhase>("idle");
  const [pausedFrom, setPausedFrom] = useState<TimedPhase>("round");
  const [currentRound, setCurrentRound] = useState(1);
  const [remainingMs, setRemainingMs] = useState(DEFAULT_SETTINGS.roundDuration * 1000);
  const [currentCombination, setCurrentCombination] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [speechWarning, setSpeechWarning] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const deadlineRef = useRef(0);
  const comboDeadlineRef = useRef(Number.POSITIVE_INFINITY);
  const pausedRemainingRef = useRef(0);
  const pausedComboRemainingRef = useRef(Number.POSITIVE_INFINITY);
  const lastCombinationIndexRef = useRef(-1);
  const settingsRef = useRef(settings);
  const currentRoundRef = useRef(currentRound);
  const audioContextRef = useRef<AudioContext | null>(null);

  const draftCombinationCount = parseCombinations(draft.combinationsText).length;
  const isRunning = phase === "countdown" || phase === "round" || phase === "rest";
  const canOpenSettings = phase === "idle" || phase === "finished";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = loadSettings();
      const systemTheme: Theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      const resolved = localStorage.getItem(STORAGE_KEY) ? saved : { ...saved, theme: systemTheme };
      setSettings(resolved);
      setDraft(resolved);
      setRemainingMs(resolved.roundDuration * 1000);
      setIsHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
    document.documentElement.style.colorScheme = settings.theme;
    if (isHydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [isHydrated, settings]);

  useEffect(() => {
    currentRoundRef.current = currentRound;
  }, [currentRound]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      const timer = setTimeout(() => {
        setSpeechWarning("Voice playback is not supported in this browser. The visual timer still works.");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  const cancelSpeech = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((combination: string[], customSettings?: WorkoutSettings) => {
    if (!("speechSynthesis" in window)) return;
    const activeSettings = customSettings ?? settingsRef.current;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(combination.join(", "));
    const availableVoices = getEnglishVoices();
    utterance.voice = availableVoices.find((voice) => voice.default)
      ?? availableVoices[0]
      ?? null;
    utterance.lang = utterance.voice?.lang ?? "en-US";
    utterance.rate = activeSettings.voiceRate;
    window.speechSynthesis.speak(utterance);
  }, []);

  const ensureAudio = useCallback(() => {
    if (!("AudioContext" in window)) return null;
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    if (context.state === "suspended") void context.resume();
    return context;
  }, []);

  const playBell = useCallback((kind: "start" | "end" | "complete") => {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    const hits = kind === "complete" ? [0, 0.24, 0.48] : [0];
    hits.forEach((offset) => {
      [kind === "start" ? 620 : 460, kind === "start" ? 930 : 690].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.22 : 0.1, now + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.65);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + 0.7);
      });
    });
  }, [ensureAudio]);

  const chooseNextCombination = useCallback((): string[] => {
    const available = parseCombinations(settingsRef.current.combinationsText);
    if (available.length === 0) return [];
    let nextIndex: number;
    if (settingsRef.current.randomize) {
      nextIndex = Math.floor(Math.random() * available.length);
      if (available.length > 1 && nextIndex === lastCombinationIndexRef.current)
        nextIndex = (nextIndex + 1 + Math.floor(Math.random() * (available.length - 1))) % available.length;
    } else {
      nextIndex = (lastCombinationIndexRef.current + 1) % available.length;
    }
    lastCombinationIndexRef.current = nextIndex;
    return available[nextIndex];
  }, []);

  const beginRound = useCallback((roundNumber: number, startTime = performance.now()) => {
    const firstCombination = chooseNextCombination();
    currentRoundRef.current = roundNumber;
    setCurrentRound(roundNumber);
    setCurrentCombination(firstCombination);
    setPhase("round");
    deadlineRef.current = startTime + settingsRef.current.roundDuration * 1000;
    comboDeadlineRef.current = startTime + combinationInterval(firstCombination);
    setRemainingMs(settingsRef.current.roundDuration * 1000);
    playBell("start");
    speak(firstCombination);
  }, [chooseNextCombination, playBell, speak]);

  useEffect(() => {
    if (!isRunning) return;
    function tick() {
      const now = performance.now();
      const nextRemaining = Math.max(0, deadlineRef.current - now);
      setRemainingMs(nextRemaining);
      if (phase === "round" && now >= comboDeadlineRef.current && nextRemaining > 0) {
        const nextCombination = chooseNextCombination();
        const interval = combinationInterval(nextCombination);
        if (nextRemaining >= interval) {
          setCurrentCombination(nextCombination);
          speak(nextCombination);
          comboDeadlineRef.current = now + interval;
        } else {
          comboDeadlineRef.current = Number.POSITIVE_INFINITY;
        }
      }
      if (nextRemaining > 0) return;
      deadlineRef.current = Number.POSITIVE_INFINITY;
      if (phase === "countdown") {
        beginRound(1, now);
        return;
      }
      if (phase === "round") {
        cancelSpeech();
        if (currentRoundRef.current >= settingsRef.current.rounds) {
          playBell("complete");
          setPhase("finished");
          setCurrentCombination([]);
          setRemainingMs(0);
          return;
        }
        playBell("end");
        if (settingsRef.current.restDuration === 0) {
          beginRound(currentRoundRef.current + 1, now);
        } else {
          setPhase("rest");
          setCurrentCombination([]);
          deadlineRef.current = now + settingsRef.current.restDuration * 1000;
          setRemainingMs(settingsRef.current.restDuration * 1000);
        }
        return;
      }
      beginRound(currentRoundRef.current + 1, now);
    }
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [beginRound, cancelSpeech, chooseNextCombination, isRunning, phase, playBell, speak]);

  function startWorkout() {
    if (Object.keys(validateSettings(settings)).length > 0) {
      openSettings();
      return;
    }
    ensureAudio();
    cancelSpeech();
    lastCombinationIndexRef.current = -1;
    currentRoundRef.current = 1;
    setCurrentRound(1);
    setCurrentCombination([]);
    if (settingsRef.current.prepareDuration === 0) {
      beginRound(1);
      return;
    }
    setPhase("countdown");
    deadlineRef.current = performance.now() + settingsRef.current.prepareDuration * 1000;
    comboDeadlineRef.current = Number.POSITIVE_INFINITY;
    setRemainingMs(settingsRef.current.prepareDuration * 1000);
  }

  function pauseWorkout() {
    if (!isRunning) return;
    const now = performance.now();
    pausedRemainingRef.current = Math.max(0, deadlineRef.current - now);
    pausedComboRemainingRef.current = Math.max(0, comboDeadlineRef.current - now);
    setPausedFrom(phase);
    setRemainingMs(pausedRemainingRef.current);
    setPhase("paused");
    cancelSpeech();
  }

  function resumeWorkout() {
    if (phase !== "paused") return;
    const now = performance.now();
    deadlineRef.current = now + pausedRemainingRef.current;
    comboDeadlineRef.current = pausedFrom === "round"
      ? now + pausedComboRemainingRef.current
      : Number.POSITIVE_INFINITY;
    setPhase(pausedFrom);
  }

  function stopWorkout() {
    cancelSpeech();
    deadlineRef.current = Number.POSITIVE_INFINITY;
    comboDeadlineRef.current = Number.POSITIVE_INFINITY;
    setPhase("idle");
    setCurrentRound(1);
    setCurrentCombination([]);
    setRemainingMs(settingsRef.current.roundDuration * 1000);
  }

  function openSettings() {
    if (!canOpenSettings) return;
    setDraft(settings);
    setErrors({});
    dialogRef.current?.showModal();
  }

  function closeSettings() {
    cancelSpeech();
    setDraft(settings);
    setErrors({});
    dialogRef.current?.close();
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateSettings(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSettings(draft);
    settingsRef.current = draft;
    if (phase === "idle") setRemainingMs(draft.roundDuration * 1000);
    dialogRef.current?.close();
  }

  function selectPreset(preset: PresetName) {
    setDraft((current) => ({
      ...current,
      preset,
      combinationsText: preset === "Custom" ? current.combinationsText : PRESETS[preset].join("\n"),
    }));
    setErrors((current) => ({ ...current, combinations: undefined }));
  }

  function updateCombinations(value: string) {
    setDraft((current) => ({ ...current, combinationsText: value, preset: "Custom" }));
    if (parseCombinations(value).length > 0)
      setErrors((current) => ({ ...current, combinations: undefined }));
  }

  function testVoice() {
    ensureAudio();
    speak(["Jab", "Cross", "Left Hook"], draft);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement || dialogRef.current?.open) return;
      if (isRunning) {
        event.preventDefault();
        pauseWorkout();
      } else if (phase === "paused") {
        event.preventDefault();
        resumeWorkout();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => () => {
    cancelSpeech();
    if (audioContextRef.current) void audioContextRef.current.close();
  }, [cancelSpeech]);

  const timerValue = phase === "idle" ? settings.roundDuration * 1000 : remainingMs;
  const phaseDuration = phase === "countdown" ? settings.prepareDuration
    : phase === "rest" ? settings.restDuration : settings.roundDuration;
  const combinationCopy = currentCombination.length > 0
    ? currentCombination.join("  ·  ")
    : phase === "rest" ? "Breathe. Reset. Stay ready."
      : phase === "countdown" ? "Hands up. Find your stance."
        : phase === "finished" ? "Strong work. Session complete."
          : "Your next combination will appear here.";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workout">Skip to workout</a>
      <main id="workout" className="workout-layout">
        <section className={`timer-card phase-${phase}`} aria-labelledby="phase-heading">
          <div className="phase-row">
            <h1 className="phase-badge" id="phase-heading"><span aria-hidden="true" />{phaseLabel(phase)}</h1>
            <span className="round-label">
              {phase === "countdown" ? "Workout starting" : (
                <>Round <strong>{currentRound}</strong> <span>of</span> <strong>{settings.rounds}</strong></>
              )}
            </span>
          </div>
          <div className="timer-block">
            <time className="timer" aria-live="off">{formatTime(timerValue)}</time>
            <div className="progress-track" aria-hidden="true">
              <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, timerValue / (phaseDuration * 1000 || 1)))})` }} />
            </div>
          </div>
          <div className="combination-panel" aria-live="polite" aria-atomic="true">
            <p>{combinationCopy}</p>
          </div>
          <div className="workout-controls">
            {phase === "idle" ? <button className="button button-primary" type="button" onClick={startWorkout}>Start Workout</button> : null}
            {phase === "idle" ? (
              <button className="button button-secondary" type="button" onClick={openSettings}>
                Configure Workout
              </button>
            ) : null}
            {isRunning ? <button className="button button-primary" type="button" onClick={pauseWorkout}>Pause</button> : null}
            {phase === "paused" ? <button className="button button-primary" type="button" onClick={resumeWorkout}>Resume</button> : null}
            {isRunning || phase === "paused" ? <button className="button button-danger" type="button" onClick={stopWorkout}>End Workout</button> : null}
            {phase === "finished" ? <button className="button button-primary" type="button" onClick={stopWorkout}>Reset</button> : null}
          </div>
          {speechWarning ? <p className="notice" role="status">{speechWarning}</p> : null}
        </section>
      </main>

      <dialog ref={dialogRef} className="settings-dialog" aria-labelledby="settings-title"
        onCancel={(event) => { event.preventDefault(); closeSettings(); }}>
        <form method="dialog" onSubmit={saveSettings}>
          <div className="dialog-header">
            <div><p className="eyebrow">Workout setup</p><h2 id="settings-title">Settings</h2></div>
            <button className="button close-button" type="button" onClick={closeSettings} aria-label="Close settings">Close</button>
          </div>
          <div className="dialog-content">
            <fieldset className="field-group">
              <legend>Combinations</legend>
              <label htmlFor="preset">Preset</label>
              <select id="preset" value={draft.preset} onChange={(event) => {
                if (isPresetName(event.target.value)) selectPreset(event.target.value);
              }}>
                {Object.keys(PRESETS).map((preset) => <option key={preset}>{preset}</option>)}<option>Custom</option>
              </select>
              <label htmlFor="combinations">Combinations</label>
              <textarea id="combinations" rows={8} value={draft.combinationsText}
                onChange={(event) => updateCombinations(event.target.value)}
                aria-describedby={`combination-help${errors.combinations ? " combination-error" : ""}`}
                aria-invalid={Boolean(errors.combinations)} />
              <p className="field-help" id="combination-help">One combination per line. Separate strikes with semicolons. {draftCombinationCount} valid {draftCombinationCount === 1 ? "combination" : "combinations"}.</p>
              {errors.combinations ? <p className="field-error" id="combination-error" role="alert">{errors.combinations}</p> : null}
            </fieldset>

            <fieldset className="field-group">
              <legend>Appearance</legend>
              <label className="switch-row" htmlFor="dark-mode">
                <span><strong>Dark mode</strong><small>Use the dark neutral theme.</small></span>
                <input id="dark-mode" type="checkbox" checked={draft.theme === "dark"}
                  onChange={(event) => setDraft((current) => ({ ...current, theme: event.target.checked ? "dark" : "light" }))} />
              </label>
            </fieldset>

            <fieldset className="field-group">
              <legend>Timing</legend>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="rounds">Number of rounds</label>
                  <input id="rounds" type="number" min="1" step="1" inputMode="numeric" value={draft.rounds}
                    onFocus={selectZeroValue}
                    onChange={(event) => setDraft((current) => ({ ...current, rounds: Number(event.target.value) }))} aria-invalid={Boolean(errors.rounds)} />
                  {errors.rounds ? <p className="field-error" role="alert">{errors.rounds}</p> : null}
                </div>
                <DurationField id="prepare-duration" label="Prepare time" value={draft.prepareDuration}
                  error={errors.prepareDuration}
                  onChange={(value) => setDraft((current) => ({ ...current, prepareDuration: value }))} />
                <DurationField id="round-duration" label="Round duration" value={draft.roundDuration}
                  error={errors.roundDuration}
                  onChange={(value) => setDraft((current) => ({ ...current, roundDuration: value }))} />
                <DurationField id="rest-duration" label="Rest duration" value={draft.restDuration}
                  error={errors.restDuration}
                  onChange={(value) => setDraft((current) => ({ ...current, restDuration: value }))} />
              </div>
              <label className="switch-row" htmlFor="randomize">
                <span><strong>Randomize combinations</strong><small>Avoids immediate repeats when possible.</small></span>
                <input id="randomize" type="checkbox" checked={draft.randomize}
                  onChange={(event) => setDraft((current) => ({ ...current, randomize: event.target.checked }))} />
              </label>
            </fieldset>

            <fieldset className="field-group">
              <legend>Voice</legend>
              <div className="rate-row">
                <label htmlFor="voice-rate">Voice speed <strong>{draft.voiceRate.toFixed(1)}×</strong></label>
                <input id="voice-rate" type="range" min="0.5" max="1.5" step="0.1" value={draft.voiceRate}
                  onChange={(event) => setDraft((current) => ({ ...current, voiceRate: Number(event.target.value) }))} />
              </div>
              <button className="button button-secondary" type="button" onClick={testVoice}>Test Voice</button>
            </fieldset>
          </div>
          <div className="dialog-actions">
            <button className="button button-secondary" type="button" onClick={closeSettings}>Cancel</button>
            <button className="button button-primary" type="submit">Save Settings</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
