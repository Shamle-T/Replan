import { DEFAULT_SLOT_MINUTES } from "./config.js";

export function toMinutes(date: Date): number {
  return date.getTime() / 60000;
}

export function differenceInMinutes(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 60000;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export function snapToNextSlotBoundary(
  date: Date,
  slotMinutes = DEFAULT_SLOT_MINUTES
): Date {
  const slotMs = slotMinutes * 60000;
  const timestamp = date.getTime();
  const snapped = Math.ceil(timestamp / slotMs) * slotMs;

  return new Date(snapped);
}
