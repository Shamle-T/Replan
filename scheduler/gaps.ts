import { sortSchedule } from "./slots";
import type { ScheduledTask } from "./types";

export interface ScheduleGap {
  start: Date;
  end: Date;
  minutes: number;
}

export function findInternalScheduleGaps(schedule: ScheduledTask[]): ScheduleGap[] {
  const sortedSchedule = sortSchedule(schedule);
  const gaps: ScheduleGap[] = [];

  for (let index = 1; index < sortedSchedule.length; index += 1) {
    const previous = sortedSchedule[index - 1];
    const current = sortedSchedule[index];
    const milliseconds = current.start.getTime() - previous.end.getTime();
    if (milliseconds <= 0) continue;

    gaps.push({
      start: new Date(previous.end.getTime()),
      end: new Date(current.start.getTime()),
      minutes: milliseconds / 60_000,
    });
  }

  return gaps;
}

export function totalInternalGapMinutes(schedule: ScheduledTask[]): number {
  return findInternalScheduleGaps(schedule).reduce((total, gap) => total + gap.minutes, 0);
}
