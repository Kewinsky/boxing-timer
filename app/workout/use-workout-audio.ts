import { useCallback, useEffect, useRef, useState } from "react";

type BellKind = "start" | "end" | "complete";

function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  return englishVoices.length > 0 ? englishVoices : voices;
}

export function useWorkoutAudio() {
  const [speechWarning, setSpeechWarning] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if ("speechSynthesis" in window) return;
    const timer = setTimeout(() => {
      setSpeechWarning("Voice playback is not supported in this browser. The visual timer still works.");
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const cancelSpeech = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((combination: string[], voiceRate: number) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(combination.join(", "));
    const availableVoices = getEnglishVoices();
    utterance.voice = availableVoices.find((voice) => voice.default)
      ?? availableVoices[0]
      ?? null;
    utterance.lang = utterance.voice?.lang ?? "en-US";
    utterance.rate = voiceRate;
    window.speechSynthesis.speak(utterance);
  }, []);

  const ensureAudio = useCallback(() => {
    if (!("AudioContext" in window)) return null;
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    if (context.state === "suspended") void context.resume();
    return context;
  }, []);

  const playBell = useCallback((kind: BellKind) => {
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

  useEffect(() => () => {
    cancelSpeech();
    if (audioContextRef.current) void audioContextRef.current.close();
  }, [cancelSpeech]);

  return { cancelSpeech, ensureAudio, playBell, speak, speechWarning };
}
