"use client";

import type { ScheduledTask, Task } from "../scheduler";
import { formatTime } from "../lib/time";
import { priorityLabel } from "../lib/taskPriorities";

interface TimelineProps {
  tasks: Task[];
  schedule: ScheduledTask[];
  currentTime?: Date;
  compact?: boolean;
}

export default function Timeline({
  tasks,
  schedule,
  currentTime,
  compact = false,
}: TimelineProps) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const sorted = [...schedule].sort((a, b) => a.start.getTime() - b.start.getTime());

  if (sorted.length === 0) {
    return (
      <div className="empty-state">
        <strong>No schedule yet.</strong>
        <span>Add tasks, then optimize.</span>
      </div>
    );
  }

  return (
    <div className={`timeline ${compact ? "compact" : ""}`}>
      {sorted.map((placement) => {
        const task = taskMap.get(placement.taskId);
        if (!task) return null;

        const isNow = Boolean(
          currentTime &&
            placement.start.getTime() <= currentTime.getTime() &&
            currentTime.getTime() < placement.end.getTime(),
        );
        const isPast = Boolean(
          currentTime && placement.end.getTime() <= currentTime.getTime(),
        );

        return (
          <div
            className={`timeline-row ${isNow ? "now" : ""} ${isPast ? "past" : ""}`}
            key={`${placement.taskId}-${placement.start.toISOString()}`}
          >
            <div className="timeline-time">
              <strong>{formatTime(placement.start)}</strong>
              <span>{formatTime(placement.end)}</span>
            </div>
            <div className="timeline-marker" aria-hidden="true">
              <span />
            </div>
            <div className="timeline-card">
              <div className="timeline-title-row">
                <strong>{task.title}</strong>
                <span className={`priority p${task.priority}`}>{priorityLabel(task.priority)}</span>
              </div>
              {!compact ? (
                <div className="meta-row">
                  <span>{task.fixedStart ? "Fixed" : "Flexible"}</span>
                  {task.deadline ? <span>Due {formatTime(task.deadline)}</span> : null}
                  {task.optional ? <span>Optional</span> : null}
                </div>
              ) : isNow ? (
                <span className="now-label">Now</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
