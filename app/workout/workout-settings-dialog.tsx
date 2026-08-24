import {
  type Dispatch,
  type FormEventHandler,
  type RefObject,
  type SetStateAction,
} from "react";
import { DurationField } from "./duration-field";
import {
  isPresetName,
  parseCombinations,
  PRESETS,
  type SettingsErrors,
  type WorkoutSettings,
} from "./workout-settings";

interface WorkoutSettingsDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  draft: WorkoutSettings;
  errors: SettingsErrors;
  setDraft: Dispatch<SetStateAction<WorkoutSettings>>;
  setErrors: Dispatch<SetStateAction<SettingsErrors>>;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onTestVoice: () => void;
}

export function WorkoutSettingsDialog({
  dialogRef,
  draft,
  errors,
  setDraft,
  setErrors,
  onClose,
  onSubmit,
  onTestVoice,
}: WorkoutSettingsDialogProps) {
  const combinationCount = parseCombinations(draft.combinationsText).length;

  function selectPreset(value: string) {
    if (!isPresetName(value)) return;
    setDraft((current) => ({
      ...current,
      preset: value,
      combinationsText: value === "Custom"
        ? current.combinationsText
        : PRESETS[value].join("\n"),
    }));
    setErrors((current) => ({ ...current, combinations: undefined }));
  }

  function updateCombinations(value: string) {
    setDraft((current) => ({ ...current, combinationsText: value, preset: "Custom" }));
    if (parseCombinations(value).length > 0)
      setErrors((current) => ({ ...current, combinations: undefined }));
  }

  return (
    <dialog
      ref={dialogRef}
      className="settings-dialog"
      aria-labelledby="settings-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form method="dialog" onSubmit={onSubmit}>
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Workout setup</p>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button className="button close-button" type="button" onClick={onClose} aria-label="Close settings">
            Close
          </button>
        </div>

        <div className="dialog-content">
          <fieldset className="field-group">
            <legend>Combinations</legend>
            <label htmlFor="preset">Preset</label>
            <select id="preset" value={draft.preset} onChange={(event) => selectPreset(event.target.value)}>
              {Object.keys(PRESETS).map((preset) => <option key={preset}>{preset}</option>)}
              <option>Custom</option>
            </select>

            <label htmlFor="combinations">Combinations</label>
            <textarea
              id="combinations"
              rows={8}
              value={draft.combinationsText}
              onChange={(event) => updateCombinations(event.target.value)}
              aria-describedby={`combination-help${errors.combinations ? " combination-error" : ""}`}
              aria-invalid={Boolean(errors.combinations)}
            />
            <p className="field-help" id="combination-help">
              One combination per line. Separate strikes with semicolons. {combinationCount} valid{" "}
              {combinationCount === 1 ? "combination" : "combinations"}.
            </p>
            {errors.combinations
              ? <p className="field-error" id="combination-error" role="alert">{errors.combinations}</p>
              : null}
          </fieldset>

          <fieldset className="field-group">
            <legend>Appearance</legend>
            <label className="switch-row" htmlFor="dark-mode">
              <span>
                <strong>Dark mode</strong>
                <small>Use the dark neutral theme.</small>
              </span>
              <input
                id="dark-mode"
                type="checkbox"
                checked={draft.theme === "dark"}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  theme: event.target.checked ? "dark" : "light",
                }))}
              />
            </label>
          </fieldset>

          <fieldset className="field-group">
            <legend>Timing</legend>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="rounds">Number of rounds</label>
                <input
                  id="rounds"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={draft.rounds}
                  onFocus={(event) => {
                    if (event.currentTarget.value === "0") event.currentTarget.select();
                  }}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    rounds: Number(event.target.value),
                  }))}
                  aria-invalid={Boolean(errors.rounds)}
                />
                {errors.rounds ? <p className="field-error" role="alert">{errors.rounds}</p> : null}
              </div>
              <DurationField
                id="prepare-duration"
                label="Prepare time"
                value={draft.prepareDuration}
                error={errors.prepareDuration}
                onChange={(value) => setDraft((current) => ({ ...current, prepareDuration: value }))}
              />
              <DurationField
                id="round-duration"
                label="Round duration"
                value={draft.roundDuration}
                error={errors.roundDuration}
                onChange={(value) => setDraft((current) => ({ ...current, roundDuration: value }))}
              />
              <DurationField
                id="rest-duration"
                label="Rest duration"
                value={draft.restDuration}
                error={errors.restDuration}
                onChange={(value) => setDraft((current) => ({ ...current, restDuration: value }))}
              />
            </div>

            <label className="switch-row" htmlFor="randomize">
              <span>
                <strong>Randomize combinations</strong>
                <small>Avoids immediate repeats when possible.</small>
              </span>
              <input
                id="randomize"
                type="checkbox"
                checked={draft.randomize}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  randomize: event.target.checked,
                }))}
              />
            </label>
          </fieldset>

          <fieldset className="field-group">
            <legend>Voice</legend>
            <div className="rate-row">
              <label htmlFor="voice-rate">
                Voice speed <strong>{draft.voiceRate.toFixed(1)}×</strong>
              </label>
              <input
                id="voice-rate"
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={draft.voiceRate}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  voiceRate: Number(event.target.value),
                }))}
              />
            </div>
            <button className="button button-secondary" type="button" onClick={onTestVoice}>
              Test Voice
            </button>
          </fieldset>
        </div>

        <div className="dialog-actions">
          <button className="button button-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="button button-primary" type="submit">Save Settings</button>
        </div>
      </form>
    </dialog>
  );
}
