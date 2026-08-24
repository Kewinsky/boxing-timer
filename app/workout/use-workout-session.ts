import { useCallback, useEffect, useRef, useState } from "react";
import {
  combinationInterval,
  type TimedPhase,
  type WorkoutPhase,
} from "./timer-utils";
import { useWorkoutAudio } from "./use-workout-audio";
import { parseCombinations, type WorkoutSettings } from "./workout-settings";

export function useWorkoutSession(settings: WorkoutSettings) {
  const [phase, setPhase] = useState<WorkoutPhase>("idle");
  const [pausedFrom, setPausedFrom] = useState<TimedPhase>("round");
  const [currentRound, setCurrentRound] = useState(1);
  const [remainingMs, setRemainingMs] = useState(settings.roundDuration * 1000);
  const [currentCombination, setCurrentCombination] = useState<string[]>([]);

  const deadlineRef = useRef(0);
  const comboDeadlineRef = useRef(Number.POSITIVE_INFINITY);
  const pausedRemainingRef = useRef(0);
  const pausedComboRemainingRef = useRef(Number.POSITIVE_INFINITY);
  const lastCombinationIndexRef = useRef(-1);
  const settingsRef = useRef(settings);
  const currentRoundRef = useRef(currentRound);

  const { cancelSpeech, ensureAudio, playBell, speak, speechWarning } = useWorkoutAudio();
  const isRunning = phase === "countdown" || phase === "round" || phase === "rest";

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    currentRoundRef.current = currentRound;
  }, [currentRound]);

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
    speak(firstCombination, settingsRef.current.voiceRate);
  }, [chooseNextCombination, playBell, speak]);

  useEffect(() => {
    if (!isRunning) return;

    function finishWorkout() {
      playBell("complete");
      setPhase("finished");
      setCurrentCombination([]);
      setRemainingMs(0);
    }

    function beginRest(now: number) {
      playBell("end");
      if (settingsRef.current.restDuration === 0) {
        beginRound(currentRoundRef.current + 1, now);
        return;
      }
      setPhase("rest");
      setCurrentCombination([]);
      deadlineRef.current = now + settingsRef.current.restDuration * 1000;
      setRemainingMs(settingsRef.current.restDuration * 1000);
    }

    function updateCombination(now: number, nextRemaining: number) {
      if (phase !== "round" || now < comboDeadlineRef.current || nextRemaining <= 0) return;
      const nextCombination = chooseNextCombination();
      const interval = combinationInterval(nextCombination);
      if (nextRemaining < interval) {
        comboDeadlineRef.current = Number.POSITIVE_INFINITY;
        return;
      }
      setCurrentCombination(nextCombination);
      speak(nextCombination, settingsRef.current.voiceRate);
      comboDeadlineRef.current = now + interval;
    }

    function tick() {
      const now = performance.now();
      const nextRemaining = Math.max(0, deadlineRef.current - now);
      setRemainingMs(nextRemaining);
      updateCombination(now, nextRemaining);
      if (nextRemaining > 0) return;

      deadlineRef.current = Number.POSITIVE_INFINITY;
      if (phase === "countdown") {
        beginRound(1, now);
        return;
      }
      if (phase === "round") {
        cancelSpeech();
        if (currentRoundRef.current >= settingsRef.current.rounds) {
          finishWorkout();
          return;
        }
        beginRest(now);
        return;
      }
      beginRound(currentRoundRef.current + 1, now);
    }

    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [beginRound, cancelSpeech, chooseNextCombination, isRunning, phase, playBell, speak]);

  const startWorkout = useCallback(() => {
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
  }, [beginRound, cancelSpeech, ensureAudio]);

  const pauseWorkout = useCallback(() => {
    if (!isRunning) return;
    const now = performance.now();
    pausedRemainingRef.current = Math.max(0, deadlineRef.current - now);
    pausedComboRemainingRef.current = Math.max(0, comboDeadlineRef.current - now);
    setPausedFrom(phase);
    setRemainingMs(pausedRemainingRef.current);
    setPhase("paused");
    cancelSpeech();
  }, [cancelSpeech, isRunning, phase]);

  const resumeWorkout = useCallback(() => {
    if (phase !== "paused") return;
    const now = performance.now();
    deadlineRef.current = now + pausedRemainingRef.current;
    comboDeadlineRef.current = pausedFrom === "round"
      ? now + pausedComboRemainingRef.current
      : Number.POSITIVE_INFINITY;
    setPhase(pausedFrom);
  }, [pausedFrom, phase]);

  const stopWorkout = useCallback(() => {
    cancelSpeech();
    deadlineRef.current = Number.POSITIVE_INFINITY;
    comboDeadlineRef.current = Number.POSITIVE_INFINITY;
    setPhase("idle");
    setCurrentRound(1);
    setCurrentCombination([]);
    setRemainingMs(settingsRef.current.roundDuration * 1000);
  }, [cancelSpeech]);

  const testVoice = useCallback((voiceRate: number) => {
    ensureAudio();
    speak(["Jab", "Cross", "Left Hook"], voiceRate);
  }, [ensureAudio, speak]);

  const timerValue = phase === "idle" ? settings.roundDuration * 1000 : remainingMs;
  const displayedPhase = phase === "paused" ? pausedFrom : phase;
  const phaseDuration = displayedPhase === "countdown"
    ? settings.prepareDuration
    : displayedPhase === "rest"
      ? settings.restDuration
      : settings.roundDuration;

  return {
    cancelSpeech,
    currentCombination,
    currentRound,
    isRunning,
    pauseWorkout,
    phase,
    phaseDuration,
    resumeWorkout,
    speechWarning,
    startWorkout,
    stopWorkout,
    testVoice,
    timerValue,
  };
}
