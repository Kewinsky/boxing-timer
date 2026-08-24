"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useWorkoutSession } from "./workout/use-workout-session";
import { WorkoutCard } from "./workout/workout-card";
import {
  DEFAULT_SETTINGS,
  hasStoredSettings,
  loadSettings,
  persistSettings,
  validateSettings,
  type SettingsErrors,
  type Theme,
  type WorkoutSettings,
} from "./workout/workout-settings";
import { WorkoutSettingsDialog } from "./workout/workout-settings-dialog";

export function WorkoutTimer() {
  const [settings, setSettings] = useState<WorkoutSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<WorkoutSettings>(DEFAULT_SETTINGS);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const workout = useWorkoutSession(settings);
  const { isRunning, pauseWorkout, phase, resumeWorkout } = workout;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedSettings = loadSettings();
      const systemTheme: Theme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      const resolvedSettings = hasStoredSettings()
        ? savedSettings
        : { ...savedSettings, theme: systemTheme };

      setSettings(resolvedSettings);
      setDraft(resolvedSettings);
      setIsHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
    document.documentElement.style.colorScheme = settings.theme;
    if (isHydrated) persistSettings(settings);
  }, [isHydrated, settings]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || dialogRef.current?.open
      ) return;

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
  }, [isRunning, pauseWorkout, phase, resumeWorkout]);

  function openSettings() {
    if (phase !== "idle" && phase !== "finished") return;
    setDraft(settings);
    setErrors({});
    dialogRef.current?.showModal();
  }

  function closeSettings() {
    workout.cancelSpeech();
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
    dialogRef.current?.close();
  }

  function startWorkout() {
    if (Object.keys(validateSettings(settings)).length > 0) {
      openSettings();
      return;
    }
    workout.startWorkout();
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workout">Skip to workout</a>
      <main id="workout" className="workout-layout">
        <WorkoutCard
          phase={workout.phase}
          currentRound={workout.currentRound}
          totalRounds={settings.rounds}
          timerValue={workout.timerValue}
          phaseDuration={workout.phaseDuration}
          currentCombination={workout.currentCombination}
          speechWarning={workout.speechWarning}
          onStart={startWorkout}
          onConfigure={openSettings}
          onPause={workout.pauseWorkout}
          onResume={workout.resumeWorkout}
          onStop={workout.stopWorkout}
        />
      </main>

      <WorkoutSettingsDialog
        dialogRef={dialogRef}
        draft={draft}
        errors={errors}
        setDraft={setDraft}
        setErrors={setErrors}
        onClose={closeSettings}
        onSubmit={saveSettings}
        onTestVoice={() => workout.testVoice(draft.voiceRate)}
      />
    </div>
  );
}
