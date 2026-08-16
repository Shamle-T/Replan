"use client";

import type { ScheduledTask, Task } from "../scheduler";
import { formatTime, formatTimeRange } from "../lib/time";

interface NowCardProps { task?: Task; placement?: ScheduledTask; currentTime: Date; extraMinutes: number; onDone: () => void; onAdjust: (minutes: number) => void; onSkip: () => void; onCancel: () => void; }
export default function NowCard({ task, placement, currentTime, extraMinutes, onDone, onAdjust, onSkip, onCancel }: NowCardProps) {
  if (!task || !placement) return <section className="live-now-card"><span className="eyebrow">Now · {formatTime(currentTime)}</span><h2>Open time</h2><p>Nothing is scheduled right now.</p></section>;
  const remaining = Math.max(0, Math.ceil((placement.end.getTime() - currentTime.getTime()) / 60_000));
  return <section className="live-now-card"><span className="eyebrow">Now · {remaining} min remaining</span><h2>{task.title}</h2><p>{formatTimeRange(placement.start, placement.end)}</p><div className="live-actions"><button className="primary-action" type="button" onClick={onDone}>Done</button><button type="button" onClick={() => onAdjust(-15)} disabled={extraMinutes < 15}>-15m</button><button type="button" onClick={() => onAdjust(15)}>+15m</button><button type="button" onClick={() => onAdjust(30)}>+30m</button><button type="button" onClick={onSkip}>Skip</button><button type="button" className="danger" onClick={onCancel}>Cancel</button></div>{extraMinutes > 0 ? <small>{extraMinutes} additional minutes requested</small> : null}</section>;
}
