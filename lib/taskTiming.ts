import { dateFromTimeInput } from "./time";

export function fixedDurationMinutes(start?: Date, end?: Date): number {
  if (!start || !end || end.getTime() <= start.getTime()) return 0;
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

export function deriveFixedEnd(
  baseDate: Date,
  startValue: string,
  durationMinutes: number,
): Date | undefined {
  const start = dateFromTimeInput(baseDate, startValue);
  if (!start || !Number.isInteger(durationMinutes) || durationMinutes <= 0) return undefined;
  return new Date(start.getTime() + durationMinutes * 60_000);
}
