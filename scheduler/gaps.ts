import { occupiedInterval } from "./occupancy";
import { sortSchedule } from "./slots";
import type { ScheduledTask, Task } from "./types";

export interface ScheduleGap {
  start: Date;
  end: Date;
  minutes: number;
}

/**
 * Returns gaps between occupied task intervals. Travel-before and travel-after buffers are treated
 * as occupied time, so the UI never advertises travel as free time.
 */
export function findInternalScheduleGaps(
  schedule: ScheduledTask[],
  tasks: Task[] = [],
): ScheduleGap[] {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const sorted = sortSchedule(schedule);
  const gaps: ScheduleGap[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const previousOccupied = occupiedInterval(previous, taskMap.get(previous.taskId));
    const nextOccupied = occupiedInterval(current, taskMap.get(current.taskId));
    const milliseconds = nextOccupied.start.getTime() - previousOccupied.end.getTime();
    if (milliseconds <= 0) continue;

    gaps.push({
      start: new Date(previousOccupied.end.getTime()),
      end: new Date(nextOccupied.start.getTime()),
      minutes: milliseconds / 60_000,
    });
  }

  return gaps;
}

/** Shows all free periods inside the configured calendar day, including edges. */
export function findScheduleGaps(
  schedule: ScheduledTask[],
  tasks: Task[],
  dayStart: Date,
  dayEnd: Date,
): ScheduleGap[] {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const occupied = schedule
    .map((item) => {
      const interval = occupiedInterval(item, taskMap.get(item.taskId));
      return { start: interval.start, end: interval.end };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());

  const gaps: ScheduleGap[] = [];
  let cursor = new Date(dayStart.getTime());

  for (const interval of occupied) {
    if (interval.end.getTime() <= dayStart.getTime()) continue;
    if (interval.start.getTime() >= dayEnd.getTime()) break;
    const start = new Date(Math.max(cursor.getTime(), dayStart.getTime()));
    const end = new Date(Math.min(interval.start.getTime(), dayEnd.getTime()));
    if (end.getTime() > start.getTime()) {
      gaps.push({ start, end, minutes: (end.getTime() - start.getTime()) / 60_000 });
    }
    if (interval.end.getTime() > cursor.getTime()) {
      cursor = new Date(interval.end.getTime());
    }
  }

  if (cursor.getTime() < dayEnd.getTime()) {
    gaps.push({
      start: cursor,
      end: new Date(dayEnd.getTime()),
      minutes: (dayEnd.getTime() - cursor.getTime()) / 60_000,
    });
  }

  return gaps;
}

export function totalInternalGapMinutes(
  schedule: ScheduledTask[],
  tasks: Task[] = [],
): number {
  return findInternalScheduleGaps(schedule, tasks).reduce(
    (total, gap) => total + gap.minutes,
    0,
  );
}

export function totalOpenMinutes(
  schedule: ScheduledTask[],
  tasks: Task[],
  dayStart: Date,
  dayEnd: Date,
): number {
  return findScheduleGaps(schedule, tasks, dayStart, dayEnd).reduce(
    (total, gap) => total + gap.minutes,
    0,
  );
}
