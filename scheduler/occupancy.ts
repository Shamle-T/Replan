import { addMinutes, intervalsOverlap } from "./slots";
import type { ScheduledTask, Task } from "./types";

export interface OccupiedInterval {
  taskId: string;
  start: Date;
  taskStart: Date;
  taskEnd: Date;
  end: Date;
  travelMinutesBefore: number;
  travelMinutesAfter: number;
  bufferMinutesAfter: number;
}

export function travelMinutesForTask(task?: Task): number {
  if (!task) return 0;
  const value = task.travelMinutesBefore ?? 0;
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function travelMinutesAfterTask(task?: Task): number {
  if (!task) return 0;
  const value = task.travelMinutesAfter ?? 0;
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function bufferMinutesAfterTask(task?: Task): number {
  if (!task) return 0;
  const value = task.bufferMinutesAfter ?? 0;
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function occupiedInterval(
  placement: ScheduledTask,
  task?: Task,
): OccupiedInterval {
  const travelMinutesBefore = travelMinutesForTask(task);
  const travelMinutesAfter = travelMinutesAfterTask(task);
  const bufferMinutesAfter = bufferMinutesAfterTask(task);
  return {
    taskId: placement.taskId,
    start: addMinutes(placement.start, -travelMinutesBefore),
    taskStart: new Date(placement.start.getTime()),
    taskEnd: new Date(placement.end.getTime()),
    end: addMinutes(placement.end, travelMinutesAfter + bufferMinutesAfter),
    travelMinutesBefore,
    travelMinutesAfter,
    bufferMinutesAfter,
  };
}

export function occupiedIntervalsOverlap(
  a: ScheduledTask,
  aTask: Task | undefined,
  b: ScheduledTask,
  bTask: Task | undefined,
): boolean {
  const first = occupiedInterval(a, aTask);
  const second = occupiedInterval(b, bTask);
  return intervalsOverlap(first.start, first.end, second.start, second.end);
}

export function placementConflictsWithSchedule(
  candidate: ScheduledTask,
  candidateTask: Task,
  schedule: ScheduledTask[],
  tasks: Task[],
): boolean {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  return schedule.some((existing) =>
    occupiedIntervalsOverlap(
      candidate,
      candidateTask,
      existing,
      taskMap.get(existing.taskId),
    ),
  );
}