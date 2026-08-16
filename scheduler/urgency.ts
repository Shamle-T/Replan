import { minutesBetween } from "./slots";
import type { SchedulingOptions, Task } from "./types";

export interface TaskUrgency {
  taskId: string;
  mandatoryRank: number;
  deadlineTime: number;
  windowMinutes: number;
  priorityRank: number;
  durationRank: number;
}

export function getTaskUrgency(task: Task, options: SchedulingOptions): TaskUrgency {
  const latest = task.latestEnd ?? task.deadline ?? options.dayEnd;
  const earliest = task.earliestStart ?? options.dayStart;

  return {
    taskId: task.id,
    mandatoryRank: task.optional ? 1 : 0,
    deadlineTime: (task.deadline ?? options.dayEnd).getTime(),
    windowMinutes: Math.max(0, minutesBetween(earliest, latest)),
    priorityRank: -task.priority,
    durationRank: -task.durationMinutes,
  };
}

export function compareTaskUrgency(
  a: Task,
  b: Task,
  options: SchedulingOptions,
): number {
  const left = getTaskUrgency(a, options);
  const right = getTaskUrgency(b, options);

  return (
    left.mandatoryRank - right.mandatoryRank ||
    left.deadlineTime - right.deadlineTime ||
    left.windowMinutes - right.windowMinutes ||
    left.priorityRank - right.priorityRank ||
    left.durationRank - right.durationRank ||
    a.id.localeCompare(b.id)
  );
}
