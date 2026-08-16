import { minutesBetween } from "../scheduler/slots";
import type {
  ScheduleChange,
  ScheduledTask,
  Task,
} from "../scheduler/types";

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
