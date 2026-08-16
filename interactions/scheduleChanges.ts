import { addMinutes, minutesBetween } from "../scheduler/slots";
import type {
  ScheduleChange,
  ScheduledTask,
  Task,
} from "../scheduler/types";

export function makeCompletedChange(
  taskId: string,
  currentTime: Date,
): ScheduleChange {
  return {
    type: "TASK_COMPLETED",
    taskId,
    actualEnd: new Date(currentTime.getTime()),
  };
}

export function makeOverrunChange(
  taskId: string,
  placement: ScheduledTask,
  extraMinutes: 15 | 30,
): ScheduleChange {
  return {
    type: "TASK_OVERRUN",
    taskId,
    newExpectedEnd: addMinutes(placement.end, extraMinutes),
  };
}

export function makeCancelChange(taskId: string): ScheduleChange {
  return { type: "TASK_CANCELLED", taskId };
}

export function makeSkipChange(taskId: string): ScheduleChange {
  return { type: "TASK_SKIPPED", taskId };
}

export function applyChangeToTasks(
  tasks: Task[],
  schedule: ScheduledTask[],
  change: ScheduleChange,
): Task[] {
  const placement = schedule.find((item) => item.taskId === change.taskId);
  return tasks.map((task) => {
    if (task.id !== change.taskId) return task;

    if (change.type === "TASK_COMPLETED") {
      return {
        ...task,
        status: "completed",
        fixedEnd: task.fixedEnd ? new Date(change.actualEnd.getTime()) : task.fixedEnd,
      };
    }
    if (change.type === "TASK_CANCELLED") {
      return { ...task, status: "cancelled" };
    }
    if (change.type === "TASK_SKIPPED") {
      return { ...task, status: "skipped" };
    }
    if (change.type === "TASK_OVERRUN") {
      return {
        ...task,
        status: "in-progress",
        fixedEnd: task.fixedEnd
          ? new Date(change.newExpectedEnd.getTime())
          : task.fixedEnd,
        durationMinutes: placement
          ? Math.max(
              1,
              Math.round(minutesBetween(placement.start, change.newExpectedEnd)),
            )
          : task.durationMinutes,
      };
    }
    return task;
  });
}