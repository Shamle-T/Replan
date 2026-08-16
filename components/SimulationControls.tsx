"use client";

import type { SimulationSpeed } from "../lib/simulation";
import { formatTime } from "../lib/time";

interface SimulationControlsProps { currentTime: Date; playing: boolean; speed: SimulationSpeed; onPlayingChange: (value: boolean) => void; onSpeedChange: (value: SimulationSpeed) => void; onNext: () => void; onReset: () => void; }
export default function SimulationControls(props: SimulationControlsProps) {
  return <section className="simulation-bar"><strong>Simulation · {formatTime(props.currentTime)}</strong><div>{([1, 5, 10, 30] as SimulationSpeed[]).map((speed) => <button key={speed} type="button" className={props.speed === speed ? "active" : ""} onClick={() => props.onSpeedChange(speed)}>{speed} min/s</button>)}<button type="button" className="primary-action" onClick={() => props.onPlayingChange(!props.playing)}>{props.playing ? "Pause" : "Play"}</button><button type="button" onClick={props.onNext}>Next event</button><button type="button" onClick={props.onReset}>Reset</button></div></section>;
}
