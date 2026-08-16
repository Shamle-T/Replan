"use client";

import type { SimulationSpeed } from "../lib/simulation";
import { formatTime } from "../lib/time";

interface SimulationControlsProps {
  mode: "simulation" | "real";
  onModeChange: (mode: "simulation" | "real") => void;
  currentTime: Date;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  speed: SimulationSpeed;
  onSpeedChange: (speed: SimulationSpeed) => void;
  onNext: () => void;
  onReset: () => void;
}

export default function SimulationControls({
  mode,
  onModeChange,
  currentTime,
  playing,
  onPlayingChange,
  speed,
  onSpeedChange,
  onNext,
  onReset,
}: SimulationControlsProps) {
  return (
    <section className="simulation-bar" aria-label="Simulation controls">
      <div className="simulation-label">
        <span className={`simulation-dot ${playing && mode === "simulation" ? "active" : ""}`} />
        <span>{mode === "simulation" ? "Simulation" : "Live clock"}</span>
        <strong>{formatTime(currentTime)}</strong>
      </div>

      <div className="simulation-actions">
        <div className="clock-mode-switch" aria-label="Clock mode">
          <button
            type="button"
            className={mode === "simulation" ? "active" : ""}
            onClick={() => onModeChange("simulation")}
          >
            Demo
          </button>
          <button
            type="button"
            className={mode === "real" ? "active" : ""}
            onClick={() => onModeChange("real")}
          >
            Real
          </button>
        </div>

        {mode === "simulation" ? (
          <>
            <div className="simulation-step-group" aria-label="Minutes advanced per second">
              {([1, 5, 10, 30] as SimulationSpeed[]).map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={speed === minutes ? "active" : ""}
                  onClick={() => onSpeedChange(minutes)}
                  title={`Advance ${minutes} simulated minutes every second`}
                >
                  {minutes} min
                </button>
              ))}
            </div>

            <button
              className={`simulation-play ${playing ? "playing" : ""}`}
              type="button"
              onClick={() => onPlayingChange(!playing)}
            >
              <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
              {playing ? "Pause" : "Play"}
            </button>
            <button className="simulation-secondary" type="button" onClick={onNext}>
              Next event
            </button>
            <button className="simulation-secondary" type="button" onClick={onReset}>
              Reset
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
