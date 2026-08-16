import type { ScheduledTask } from "./types";

export const MINUTE_MS = 60_000;

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

export function minutesBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / MINUTE_MS;
}

export function maxDate(...dates: Date[]): Date {
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

export function minDate(...dates: Date[]): Date {
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

export function snapUpToGrid(
  date: Date,
  slotMinutes: number,
  anchor: Date,
): Date {
  const slotMs = slotMinutes * MINUTE_MS;
  const elapsed = date.getTime() - anchor.getTime();
  if (elapsed <= 0) return new Date(anchor.getTime());
  const slots = Math.ceil(elapsed / slotMs);
  return new Date(anchor.getTime() + slots * slotMs);
}

export function isAlignedToGrid(
  date: Date,
  slotMinutes: number,
  anchor: Date,
): boolean {
  const slotMs = slotMinutes * MINUTE_MS;
  return (date.getTime() - anchor.getTime()) % slotMs === 0;
}

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function overlapsAny(
  candidate: ScheduledTask,
  schedule: ScheduledTask[],
): boolean {
  return schedule.some((existing) =>
    intervalsOverlap(candidate.start, candidate.end, existing.start, existing.end),
  );
}

export function sortSchedule(schedule: ScheduledTask[]): ScheduledTask[] {
  return [...schedule].sort((a, b) => {
    const byStart = a.start.getTime() - b.start.getTime();
    if (byStart !== 0) return byStart;
    const byEnd = a.end.getTime() - b.end.getTime();
    if (byEnd !== 0) return byEnd;
    return a.taskId.localeCompare(b.taskId);
  });
}

export function scheduleSignature(schedule: ScheduledTask[]): string {
  return sortSchedule(schedule)
    .map(
      (item) =>
        `${item.start.getTime().toString().padStart(14, "0")}:${item.end
          .getTime()
          .toString()
          .padStart(14, "0")}:${item.taskId}`,
    )
    .join("|");
}

export function buildCandidateStarts(
  windowStart: Date,
  windowEnd: Date,
  durationMinutes: number,
  slotMinutes: number,
  anchor: Date,
): Date[] {
  const starts: Date[] = [];
  const first = snapUpToGrid(windowStart, slotMinutes, anchor);
  const latestStart = addMinutes(windowEnd, -durationMinutes);

  for (
    let time = first.getTime();
    time <= latestStart.getTime();
    time += slotMinutes * MINUTE_MS
  ) {
    starts.push(new Date(time));
  }

  return starts;
}
