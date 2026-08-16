"use client";

import type { ScheduledTask, Task } from "../scheduler";
import { formatDurationCompact, formatTimeRange } from "../lib/time";
import { categoryForTask, categoryLabel } from "../lib/taskCategories";

interface DayCalendarProps { tasks: Task[]; schedule: ScheduledTask[]; dayStart: Date; dayEnd: Date; onTaskClick?: (taskId: string) => void; }

export default function DayCalendar({ tasks, schedule, dayStart, dayEnd, onTaskClick }: DayCalendarProps) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const sorted = [...schedule].sort((left, right) => left.start.getTime() - right.start.getTime());
  return <section className="day-calendar" aria-label="Daily schedule"><div className="day-range">{formatTimeRange(dayStart, dayEnd)}</div><div className="calendar-list">{sorted.map((placement) => { const task = taskMap.get(placement.taskId); if (!task) return null; const category = categoryForTask(task); const minutes = (placement.end.getTime() - placement.start.getTime()) / 60_000; return <button className={`calendar-event category-${category}`} key={task.id} type="button" onClick={() => onTaskClick?.(task.id)}><span className="calendar-event-time">{formatTimeRange(placement.start, placement.end)}</span><strong>{task.title}</strong><small>{categoryLabel(category)} · {formatDurationCompact(minutes)} · {task.fixedStart ? "Fixed" : "Flexible"}</small></button>; })}</div></section>;
}
