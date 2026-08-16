import type { ScheduledTask } from "../scheduler/types";

// In demo mode the label represents how many simulated minutes pass per real second.
// This is easier to understand during a pitch than abstract multipliers such as 30x or 60x.
export type SimulationSpeed = 1 | 5 | 10 | 30;

export function advanceSimulatedTime(
  current: Date,
  elapsedRealMs: number,
  minutesPerSecond: SimulationSpeed,
): Date {
  const elapsedSeconds = elapsedRealMs / 1_000;
  const simulatedMinutes = elapsedSeconds * minutesPerSecond;
  return new Date(current.getTime() + simulatedMinutes * 60_000);
}

export function nextScheduleBoundary(
  current: Date,
  schedule: ScheduledTask[],
): Date | null {
  const boundaries = schedule
    .flatMap((item) => [item.start, item.end])
    .filter((date) => date.getTime() > current.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  return boundaries[0] ? new Date(boundaries[0].getTime()) : null;
}
