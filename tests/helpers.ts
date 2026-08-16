import type { SchedulingOptions, Task } from "../scheduler";

export const at = (hour: number, minute = 0): Date =>
  new Date(2026, 7, 15, hour, minute, 0, 0);

export function task(overrides: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    durationMinutes: 60,
    priority: 3,
    optional: false,
    status: "planned",
    ...overrides,
  };
}

export const options: SchedulingOptions = {
  currentTime: at(8),
  dayStart: at(8),
  dayEnd: at(20),
  slotMinutes: 30,
};
