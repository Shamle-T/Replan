import type { ScheduledTask, Task } from "../scheduler/types";

/**
 * Live Day should derive what is happening from the actual scheduled interval,
 * not from fragile UI state. A missing legacy status is treated as planned.
 */
export function isTaskLiveEligible(task: Task | undefined): boolean {
  if (!task) return false;
  return task.status !== "completed" && task.status !== "cancelled" && task.status !== "skipped";
}

export function findCurrentPlacement(
  schedule: ScheduledTask[],
  taskMap: Map<string, Task>,
  currentTime: Date,
): ScheduledTask | undefined {
  const now = currentTime.getTime();
  return [...schedule]
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .find((item) => {
      const task = taskMap.get(item.taskId);
      return (
        isTaskLiveEligible(task) &&
        item.start.getTime() <= now &&
        now < item.end.getTime()
      );
    });
}

export function findNextPlacement(
  schedule: ScheduledTask[],
  taskMap: Map<string, Task>,
  currentTime: Date,
): ScheduledTask | undefined {
  const now = currentTime.getTime();
  return [...schedule]
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .find((item) => isTaskLiveEligible(taskMap.get(item.taskId)) && item.start.getTime() > now);
}
