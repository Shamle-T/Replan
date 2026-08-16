"use client";

import { useState } from "react";
import type { PostTaskBreak, ScheduledTask, ScheduleChange, Task } from "../scheduler";
import { formatTime, formatTimeRange } from "../lib/time";
import { categoryForTask } from "../lib/taskCategories";

interface NowCardProps {
  currentTask?: Task;
  currentPlacement?: ScheduledTask;
  currentTime: Date;
  activeBreak: PostTaskBreak | null;
  travelContext?: {
    direction: "to" | "from";
    task: Task;
    start: Date;
    end: Date;
  } | null;
  previewChange?: ScheduleChange | null;
  previewTask?: Task;
  onDone: () => void;
  extraMinutes: number;
  onAdjustTime: (deltaMinutes: number) => void;
  onCancel: () => void;
  onSkip: () => void;
}

export default function NowCard({
  currentTask,
  currentPlacement,
  currentTime,
  activeBreak,
  travelContext,
  previewChange,
  previewTask,
  onDone,
  extraMinutes,
  onAdjustTime,
  onCancel,
  onSkip,
}: NowCardProps) {
  const remaining = currentPlacement
    ? Math.max(0, Math.ceil((currentPlacement.end.getTime() - currentTime.getTime()) / 60_000))
    : 0;
  const breakSeconds = activeBreak
    ? Math.max(0, Math.ceil((activeBreak.end.getTime() - currentTime.getTime()) / 1000))
    : 0;
  const [customStep, setCustomStep] = useState("");
  const customMinutes = Number(customStep);
  const customValid = Number.isInteger(customMinutes) && customMinutes > 0 && customMinutes <= 720;


  if (previewChange && previewTask && previewChange.type !== "TASK_OVERRUN") {
    const label = previewChange.type === "TASK_COMPLETED" ? "Completed" : previewChange.type === "TASK_CANCELLED" ? "Cancelled" : "Skipped";
    const detail = previewChange.type === "TASK_COMPLETED"
      ? `${previewTask.title} finished at ${formatTime(currentTime)}`
      : previewChange.type === "TASK_CANCELLED"
        ? `${previewTask.title} was cancelled at ${formatTime(currentTime)}`
        : `${previewTask.title} was skipped at ${formatTime(currentTime)}`;

    return (
      <section className="live-now-card completed-card">
        <div className="live-card-kicker calm">
          <span className="status-dot calm" />
          Now (updated)
          <span className="live-card-time">{formatTime(currentTime)}</span>
        </div>
        <div className="idle-copy">
          <div className="completed-pill">{label}</div>
          <h2>{previewTask.title}</h2>
          <p>{detail}</p>
        </div>
      </section>
    );
  }

  if (activeBreak) {
    return (
      <section className="live-now-card relax-card">
        <div className="live-card-kicker calm">
          <span className="status-dot calm" />
          Relax
          <span className="live-card-time">{formatTime(currentTime)}</span>
        </div>
        <div className="relax-content">
          <strong className="relax-counter">{formatCountdown(breakSeconds)}</strong>
          <span>Take a moment before the next task.</span>
        </div>
      </section>
    );
  }

  if (travelContext) {
    const travelRemaining = Math.max(
      0,
      Math.ceil((travelContext.end.getTime() - currentTime.getTime()) / 60_000),
    );
    const heading =
      travelContext.direction === "to"
        ? `Traveling to ${travelContext.task.title}`
        : `Leaving ${travelContext.task.title}`;
    const detail = travelContext.task.location
      ? travelContext.direction === "to"
        ? `On the way to ${travelContext.task.location}`
        : `Traveling on from ${travelContext.task.location}`
      : travelContext.direction === "to"
        ? "Travel time reserved before the event."
        : "Travel time reserved after the event.";

    return (
      <section className="live-now-card travel-now-card">
        <div className="live-card-kicker travel-kicker">
          <span className="status-dot travel" />
          Travel
          <span className="remaining-label">{travelRemaining} min remaining</span>
        </div>
        <div className="live-task-title-row">
          <div>
            <h2>{heading}</h2>
            <p>{detail}</p>
            <small>{formatTimeRange(travelContext.start, travelContext.end)}</small>
          </div>
          <span className="live-current-time">{formatTime(currentTime)}</span>
        </div>
      </section>
    );
  }

  if (!currentTask || !currentPlacement) {
    return (
      <section className="live-now-card idle-card">
        <div className="live-card-kicker">
          <span className="status-dot idle" />
          Now
          <span className="live-card-time">{formatTime(currentTime)}</span>
        </div>
        <div className="idle-copy">
          <h2>Open time</h2>
          <p>Nothing is scheduled right now.</p>
        </div>
      </section>
    );
  }

  const category = categoryForTask(currentTask);

  return (
    <section className={`live-now-card category-accent-${category}`}>
      <div className="live-card-kicker">
        <span className="status-dot" />
        Now
        <span className="remaining-label">{remaining} min remaining</span>
      </div>

      <div className="live-task-title-row">
        <div>
          <h2>{currentTask.title}</h2>
          <p>
            {formatTimeRange(currentPlacement.start, currentPlacement.end)}
          </p>
        </div>
        <span className="live-current-time">{formatTime(currentTime)}</span>
      </div>

      <div className="live-actions live-actions-time-controls">
        <button className="button primary done-button" type="button" onClick={onDone}>
          ✓ Done
        </button>

        <TimeAdjuster
          label="15m"
          canSubtract={extraMinutes >= 15}
          onSubtract={() => onAdjustTime(-15)}
          onAdd={() => onAdjustTime(15)}
        />
        <TimeAdjuster
          label="30m"
          canSubtract={extraMinutes >= 30}
          onSubtract={() => onAdjustTime(-30)}
          onAdd={() => onAdjustTime(30)}
        />
        <div className="time-adjuster custom-time-adjuster" aria-label="Custom time adjustment">
          <button
            type="button"
            className="time-adjust-side minus"
            disabled={!customValid || extraMinutes < customMinutes}
            onClick={() => customValid && onAdjustTime(-customMinutes)}
            aria-label="Remove custom extra time"
          >−</button>
          <input
            aria-label="Custom minutes"
            inputMode="numeric"
            type="number"
            min={1}
            max={720}
            step={1}
            placeholder="--"
            value={customStep}
            onChange={(event) => setCustomStep(event.target.value)}
          />
          <button
            type="button"
            className="time-adjust-side plus"
            disabled={!customValid}
            onClick={() => customValid && onAdjustTime(customMinutes)}
            aria-label="Add custom extra time"
          >+</button>
        </div>

        <button className="button ghost" type="button" onClick={onSkip}>
          Skip
        </button>
        <button className="button ghost danger" type="button" onClick={onCancel}>
          Cancel
        </button>
        {extraMinutes > 0 ? <span className="extra-time-status">+{extraMinutes}m added</span> : null}
      </div>
    </section>
  );
}

function TimeAdjuster({
  label,
  canSubtract,
  onSubtract,
  onAdd,
}: {
  label: string;
  canSubtract: boolean;
  onSubtract: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="time-adjuster" aria-label={`${label} time adjustment`}>
      <button
        type="button"
        className="time-adjust-side minus"
        disabled={!canSubtract}
        onClick={onSubtract}
        aria-label={`Remove ${label}`}
      >−</button>
      <span>{label}</span>
      <button
        type="button"
        className="time-adjust-side plus"
        onClick={onAdd}
        aria-label={`Add ${label}`}
      >+</button>
    </div>
  );
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
