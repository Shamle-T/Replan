import { addMinutes, buildCandidateStarts, maxDate, minDate, overlapsAny } from "./slots";
import type { ScheduledTask, SchedulingOptions, Task } from "./types";

export interface TaskWindow {
  start: Date;
  end: Date;
}

export function getTaskWindow(
  task: Task,
  options: SchedulingOptions,
): TaskWindow | null {
  const start = task.earliestStart
    ? maxDate(options.dayStart, options.currentTime, task.earliestStart)
    : maxDate(options.dayStart, options.currentTime);
  const end = minDate(options.dayEnd, task.latestEnd ?? options.dayEnd, task.deadline ?? options.dayEnd);

  return addMinutes(start, task.durationMinutes) <= end ? { start, end } : null;
}

export function generateLegalPlacements(
  task: Task,
  existingSchedule: ScheduledTask[],
  options: SchedulingOptions,
): ScheduledTask[] {
  if (task.fixedStart && task.fixedEnd) {
    const placement = {
      taskId: task.id,
      start: new Date(task.fixedStart.getTime()),
      end: new Date(task.fixedEnd.getTime()),
    };
    return overlapsAny(placement, existingSchedule) ? [] : [placement];
  }

  const window = getTaskWindow(task, options);
  if (!window) return [];

  return buildCandidateStarts(
    window.start,
    window.end,
    task.durationMinutes,
    options.slotMinutes,
    options.dayStart,
  )
    .map((start) => ({
      taskId: task.id,
      start,
      end: addMinutes(start, task.durationMinutes),
    }))
    .filter((candidate) => !overlapsAny(candidate, existingSchedule));
}
