import { differenceInMinutes } from "./slots.js";
import type {
  ScheduledTask,
  SchedulerOptions,
  ScheduleValidationResult,
  Task,
  ValidationError,
  ValidationErrorCode
} from "./types.js";

const NON_FUTURE_STATUSES = new Set(["completed", "cancelled", "skipped"]);

function createError(
  code: ValidationErrorCode,
  message: string,
  taskId?: string,
  relatedTaskIds?: string[]
): ValidationError {
  return { code, message, taskId, relatedTaskIds };
}

function hasMalformedFixedInterval(task: Task): boolean {
  if (!task.fixedStart && !task.fixedEnd) {
    return false;
  }

  if (!task.fixedStart || !task.fixedEnd) {
    return true;
  }

  return task.fixedStart.getTime() >= task.fixedEnd.getTime();
}

function compareScheduledTasks(left: ScheduledTask, right: ScheduledTask): number {
  return (
    left.start.getTime() - right.start.getTime() ||
    left.end.getTime() - right.end.getTime() ||
    left.taskId.localeCompare(right.taskId)
  );
}

export function validateSchedule(
  schedule: ScheduledTask[],
  tasks: Task[],
  options: SchedulerOptions
): ScheduleValidationResult {
  const errors: ValidationError[] = [];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  for (const task of [...tasks].sort((left, right) => left.id.localeCompare(right.id))) {
    if (task.durationMinutes <= 0) {
      errors.push(
        createError(
          "INVALID_TASK_DURATION",
          `Task "${task.id}" must have a positive duration.`,
          task.id
        )
      );
    }

    if (hasMalformedFixedInterval(task)) {
      errors.push(
        createError(
          "MALFORMED_FIXED_INTERVAL",
          `Task "${task.id}" has an invalid fixed interval.`,
          task.id
        )
      );
    }
  }

  const sortedSchedule = [...schedule].sort(compareScheduledTasks);

  for (const scheduledTask of sortedSchedule) {
    const task = tasksById.get(scheduledTask.taskId);

    if (!task) {
      errors.push(
        createError(
          "UNKNOWN_TASK_REFERENCE",
          `Scheduled task "${scheduledTask.taskId}" does not match a known task.`,
          scheduledTask.taskId
        )
      );
      continue;
    }

    const scheduledDuration = differenceInMinutes(scheduledTask.start, scheduledTask.end);

    if (scheduledDuration !== task.durationMinutes) {
      errors.push(
        createError(
          "SCHEDULED_DURATION_MISMATCH",
          `Scheduled task "${task.id}" must match the task duration of ${task.durationMinutes} minutes.`,
          task.id
        )
      );
    }

    if (
      scheduledTask.start.getTime() < options.dayStart.getTime() ||
      scheduledTask.end.getTime() > options.dayEnd.getTime()
    ) {
      errors.push(
        createError(
          "OUTSIDE_DAY_BOUNDS",
          `Scheduled task "${task.id}" falls outside the configured working day.`,
          task.id
        )
      );
    }

    if (
      NON_FUTURE_STATUSES.has(task.status) &&
      scheduledTask.end.getTime() > options.currentTime.getTime()
    ) {
      errors.push(
        createError(
          "NON_SCHEDULABLE_TASK_STATUS",
          `Task "${task.id}" has status "${task.status}" and cannot remain scheduled in the future.`,
          task.id
        )
      );
    }

    if (task.fixedStart && task.fixedEnd) {
      if (
        scheduledTask.start.getTime() !== task.fixedStart.getTime() ||
        scheduledTask.end.getTime() !== task.fixedEnd.getTime()
      ) {
        errors.push(
          createError(
            "FIXED_TASK_INTERVAL_MISMATCH",
            `Task "${task.id}" must stay in its fixed interval.`,
            task.id
          )
        );
      }
    }

    if (task.deadline && scheduledTask.end.getTime() > task.deadline.getTime()) {
      errors.push(
        createError(
          "DEADLINE_VIOLATION",
          `Task "${task.id}" ends after its deadline.`,
          task.id
        )
      );
    }

    if (task.earliestStart && scheduledTask.start.getTime() < task.earliestStart.getTime()) {
      errors.push(
        createError(
          "EARLIEST_START_VIOLATION",
          `Task "${task.id}" starts before its earliest allowed time.`,
          task.id
        )
      );
    }

    if (task.latestEnd && scheduledTask.end.getTime() > task.latestEnd.getTime()) {
      errors.push(
        createError(
          "LATEST_END_VIOLATION",
          `Task "${task.id}" ends after its latest allowed time.`,
          task.id
        )
      );
    }
  }

  for (let index = 1; index < sortedSchedule.length; index += 1) {
    const previous = sortedSchedule[index - 1];
    const current = sortedSchedule[index];

    if (current.start.getTime() < previous.end.getTime()) {
      const relatedTaskIds = [previous.taskId, current.taskId].sort((left, right) =>
        left.localeCompare(right)
      );

      errors.push(
        createError(
          "OVERLAPPING_SCHEDULED_TASKS",
          `Scheduled tasks "${previous.taskId}" and "${current.taskId}" overlap.`,
          current.taskId,
          relatedTaskIds
        )
      );
    }
  }

  errors.sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      (left.taskId ?? "").localeCompare(right.taskId ?? "") ||
      (left.relatedTaskIds?.join(",") ?? "").localeCompare(right.relatedTaskIds?.join(",") ?? "") ||
      left.message.localeCompare(right.message)
  );

  return {
    ok: errors.length === 0,
    errors
  };
}
