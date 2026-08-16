"use client";

import { useState } from "react";
import type { ScheduleChange, ScheduledTask, Task } from "../scheduler";
import { findCurrentPlacement, findNextPlacement } from "../lib/liveActivity";
import { formatTime, formatTimeRange } from "../lib/time";
import { parseUpdateMessage } from "../interactions/updateParser";
import NowCard from "./NowCard";
import SimulationControls from "./SimulationControls";
import type { SimulationSpeed } from "../lib/simulation";

interface LiveDayViewProps { tasks: Task[]; schedule: ScheduledTask[]; currentTime: Date; playing: boolean; speed: SimulationSpeed; onPlayingChange: (value: boolean) => void; onSpeedChange: (value: SimulationSpeed) => void; onNext: () => void; onReset: () => void; onChange: (change: ScheduleChange) => void; notice?: string; }
export default function LiveDayView(props: LiveDayViewProps) {
  const [message, setMessage] = useState(""); const [extraMinutes, setExtraMinutes] = useState(0);
  const current = findCurrentPlacement(props.schedule, props.tasks, props.currentTime);
  const next = findNextPlacement(props.schedule, props.tasks, props.currentTime);
  const task = current ? props.tasks.find((item) => item.id === current.taskId) : undefined;
  const nextTask = next ? props.tasks.find((item) => item.id === next.taskId) : undefined;
  const apply = (change: ScheduleChange) => { props.onChange(change); if (change.type !== "TASK_OVERRUN") setExtraMinutes(0); };
  const adjust = (minutes: number) => { if (!current || !task || (minutes < 0 && extraMinutes < Math.abs(minutes))) return; setExtraMinutes((value) => Math.max(0, value + minutes)); apply({ type: "TASK_OVERRUN", taskId: task.id, newExpectedEnd: new Date(current.end.getTime() + minutes * 60_000) }); };
  const submitUpdate = (event: React.FormEvent) => { event.preventDefault(); const change = parseUpdateMessage(message, task, current, props.currentTime); if (change) { apply(change); setMessage(""); } };
  return <main className="live-shell"><header className="live-header"><div><p className="eyebrow">Live day</p><h1>Run today</h1></div></header><SimulationControls currentTime={props.currentTime} playing={props.playing} speed={props.speed} onPlayingChange={props.onPlayingChange} onSpeedChange={props.onSpeedChange} onNext={props.onNext} onReset={props.onReset} />{props.notice ? <p className="notice">{props.notice}</p> : null}<NowCard task={task} placement={current} currentTime={props.currentTime} extraMinutes={extraMinutes} onDone={() => task && apply({ type: "TASK_COMPLETED", taskId: task.id, actualEnd: props.currentTime })} onAdjust={adjust} onSkip={() => task && apply({ type: "TASK_SKIPPED", taskId: task.id })} onCancel={() => task && apply({ type: "TASK_CANCELLED", taskId: task.id })} /><section className="live-panel"><h2>Tell Replan what changed</h2><form onSubmit={submitUpdate}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="e.g. done, need 30 min, skip" /><button className="primary-action" type="submit">Apply update</button></form></section><section className="live-panel"><h2>Up next</h2>{next && nextTask ? <p><strong>{nextTask.title}</strong> · {formatTimeRange(next.start, next.end)}</p> : <p className="muted">No remaining activities.</p>}<p className="muted">Current simulation time: {formatTime(props.currentTime)}</p></section></main>;
}
