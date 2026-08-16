import type { ScheduledTask, Task } from "../scheduler";

export function findCurrentPlacement(schedule: ScheduledTask[], tasks: Task[], currentTime: Date): ScheduledTask | undefined {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  return [...schedule].sort((left, right) => left.start.getTime() - right.start.getTime()).find((placement) => {
    const task = taskMap.get(placement.taskId);
    return task && !["completed", "cancelled", "skipped"].includes(task.status) && placement.start <= currentTime && currentTime < placement.end;
  });
}

export function findNextPlacement(schedule: ScheduledTask[], tasks: Task[], currentTime: Date): ScheduledTask | undefined {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  return [...schedule].sort((left, right) => left.start.getTime() - right.start.getTime()).find((placement) => taskMap.get(placement.taskId)?.status === "planned" && placement.start > currentTime);
}
