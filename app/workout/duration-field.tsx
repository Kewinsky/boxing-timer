import {
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { formatTime, parseDurationDigits } from "./timer-utils";

interface DurationFieldProps {
  id: string;
  label: string;
  value: number;
  error?: string;
  onChange: (value: number) => void;
}

export function DurationField({ id, label, value, error, onChange }: DurationFieldProps) {
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

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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
      <input
        id={id}
        className="duration-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]{2}:[0-5][0-9]"
        value={formattedValue}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onPaste={handlePaste}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="field-error" id={`${id}-error`} role="alert">{error}</p> : null}
    </div>
  );
}
