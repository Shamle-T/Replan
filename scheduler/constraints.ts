import { intervalsOverlap, minutesBetween, sortSchedule } from "./slots";
import type {
  ScheduledTask,
  SchedulingOptions,
  Task,
  ValidationIssue,
} from "./types";

interface ValidationOptions extends SchedulingOptions {
  requireMandatoryPlacement?: boolean;
}

function isActiveForScheduling(task: Task): boolean {
  return task.status === "planned" || task.status === "in-progress";
}

export function validateTaskDefinitions(tasks: Task[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const task of tasks) {
    if (!Number.isFinite(task.durationMinutes) || task.durationMinutes <= 0) {
      issues.push({
        code: "INVALID_DURATION",
        message: `${task.title} must have a positive duration.`,
        taskIds: [task.id],
      });
    }

    const hasFixedStart = Boolean(task.fixedStart);
    const hasFixedEnd = Boolean(task.fixedEnd);
    if (hasFixedStart !== hasFixedEnd) {
      issues.push({
        code: "MISSING_FIXED_BOUND",
        message: `${task.title} needs both a fixed start and fixed end.`,
        taskIds: [task.id],
      });
    }

    if (task.fixedStart && task.fixedEnd && task.fixedEnd <= task.fixedStart) {
      issues.push({
        code: "INVALID_DURATION",
        message: `${task.title} has a fixed end that is not after its start.`,
        taskIds: [task.id],
      });
    }
  }

  return issues;
}

export function validateSchedule(
  schedule: ScheduledTask[],
  tasks: Task[],
  options: ValidationOptions,
): ValidationIssue[] {
  const issues = validateTaskDefinitions(tasks);
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const seenTaskIds = new Set<string>();
  const sortedSchedule = sortSchedule(schedule);

  for (const placement of sortedSchedule) {
    const task = taskMap.get(placement.taskId);
    if (!task) {
      issues.push({
        code: "UNKNOWN_TASK",
        message: "The schedule contains a task that no longer exists.",
        taskIds: [placement.taskId],
      });
      continue;
    }

    if (seenTaskIds.has(placement.taskId)) {
      issues.push({
        code: "DUPLICATE_PLACEMENT",
        message: `${task.title} appears more than once in the schedule.`,
        taskIds: [task.id],
      });
    }
    seenTaskIds.add(placement.taskId);

    if (placement.end <= placement.start) {
      issues.push({
        code: "INVALID_DURATION",
        message: `${task.title} has an invalid scheduled interval.`,
        taskIds: [task.id],
      });
      continue;
    }

    const scheduledMinutes = minutesBetween(placement.start, placement.end);
    if (
      task.status !== "completed" &&
      Math.abs(scheduledMinutes - task.durationMinutes) > 0.001
    ) {
      issues.push({
        code: "PLACEMENT_DURATION_MISMATCH",
        message: `${task.title} is scheduled for ${scheduledMinutes} minutes but requires ${task.durationMinutes}.`,
        taskIds: [task.id],
      });
    }

    if (
      placement.start.getTime() < options.dayStart.getTime() ||
      placement.end.getTime() > options.dayEnd.getTime()
    ) {
      issues.push({
        code: "OUTSIDE_DAY",
        message: `${task.title} falls outside the configured day.`,
        taskIds: [task.id],
      });
    }

    if (
      task.fixedStart &&
      task.fixedEnd &&
      (placement.start.getTime() !== task.fixedStart.getTime() ||
        placement.end.getTime() !== task.fixedEnd.getTime())
    ) {
      issues.push({
        code: "FIXED_TIME_MISMATCH",
        message: `${task.title} is fixed and cannot be moved.`,
        taskIds: [task.id],
      });
    }

    if (task.earliestStart && placement.start < task.earliestStart) {
      issues.push({
        code: "BEFORE_EARLIEST_START",
        message: `${task.title} starts before its availability window.`,
        taskIds: [task.id],
      });
    }

    if (task.latestEnd && placement.end > task.latestEnd) {
      issues.push({
        code: "AFTER_LATEST_END",
        message: `${task.title} finishes after its availability window.`,
        taskIds: [task.id],
      });
    }

    if (task.deadline && placement.end > task.deadline) {
      issues.push({
        code: "MISSED_DEADLINE",
        message: `${task.title} finishes after its strict deadline.`,
        taskIds: [task.id],
      });
    }
  }

  for (let index = 0; index < sortedSchedule.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < sortedSchedule.length; otherIndex += 1) {
      const first = sortedSchedule[index];
      const second = sortedSchedule[otherIndex];
      const firstTask = taskMap.get(first.taskId);
      const secondTask = taskMap.get(second.taskId);
      if (!firstTask || !secondTask) continue;

      if (intervalsOverlap(first.start, first.end, second.start, second.end)) {
        issues.push({
          code: "OVERLAP",
          message: `${firstTask.title} and ${secondTask.title} overlap.`,
          taskIds: [first.taskId, second.taskId],
        });
      }
    }
  }

  if (options.requireMandatoryPlacement ?? true) {
    for (const task of tasks) {
      if (isActiveForScheduling(task) && !task.optional && !seenTaskIds.has(task.id)) {
        issues.push({
          code: "MANDATORY_UNSCHEDULED",
          message: `${task.title} is mandatory but could not be scheduled.`,
          taskIds: [task.id],
        });
      }
    }
  }

  return dedupeIssues(issues);
}

function dedupeIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = `${issue.code}:${[...issue.taskIds].sort().join(",")}:${issue.message}`;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}
