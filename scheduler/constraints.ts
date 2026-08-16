import { intervalsOverlap, minutesBetween, sortSchedule } from "./slots";
import { occupiedInterval, occupiedIntervalsOverlap, travelMinutesForTask } from "./occupancy";
import type {
  ScheduledTask,
  SchedulingOptions,
  SchedulingWindow,
  Task,
  ValidationIssue,
} from "./types";

interface ValidationOptions extends SchedulingOptions {
  requireMandatoryPlacement?: boolean;
}

function activeForScheduling(task: Task): boolean {
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

    if (
      task.travelMinutesBefore !== undefined &&
      (!Number.isFinite(task.travelMinutesBefore) || task.travelMinutesBefore < 0)
    ) {
      issues.push({
        code: "INVALID_DURATION",
        message: `${task.title} has an invalid travel time before it.`,
        taskIds: [task.id],
      });
    }

    if (
      task.travelMinutesAfter !== undefined &&
      (!Number.isFinite(task.travelMinutesAfter) || task.travelMinutesAfter < 0)
    ) {
      issues.push({
        code: "INVALID_DURATION",
        message: `${task.title} has an invalid travel time after it.`,
        taskIds: [task.id],
      });
    }

    if (
      task.bufferMinutesAfter !== undefined &&
      (!Number.isFinite(task.bufferMinutesAfter) || task.bufferMinutesAfter < 0)
    ) {
      issues.push({
        code: "INVALID_DURATION",
        message: `${task.title} has an invalid interval after it.`,
        taskIds: [task.id],
      });
    }

    const hasStart = Boolean(task.fixedStart);
    const hasEnd = Boolean(task.fixedEnd);
    if (hasStart !== hasEnd) {
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
  const seen = new Set<string>();
  const sorted = sortSchedule(schedule);

  for (const placement of sorted) {
    const task = taskMap.get(placement.taskId);
    if (!task) {
      issues.push({
        code: "UNKNOWN_TASK",
        message: "The schedule contains a task that no longer exists.",
        taskIds: [placement.taskId],
      });
      continue;
    }

    if (seen.has(placement.taskId)) {
      issues.push({
        code: "DUPLICATE_PLACEMENT",
        message: `${task.title} appears more than once in the schedule.`,
        taskIds: [task.id],
      });
    }
    seen.add(placement.taskId);

    if (placement.end <= placement.start) {
      issues.push({
        code: "INVALID_DURATION",
        message: `${task.title} has an invalid scheduled interval.`,
        taskIds: [task.id],
      });
      continue;
    }

    const actualMinutes = minutesBetween(placement.start, placement.end);
    const historicalCompleted = task.status === "completed";
    if (!historicalCompleted && Math.abs(actualMinutes - task.durationMinutes) > 0.001) {
      issues.push({
        code: "PLACEMENT_DURATION_MISMATCH",
        message: `${task.title} is scheduled for ${actualMinutes} minutes but requires ${task.durationMinutes}.`,
        taskIds: [task.id],
      });
    }

    const occupied = occupiedInterval(placement, task);
    if (
      occupied.start.getTime() < options.dayStart.getTime() ||
      occupied.end.getTime() > options.dayEnd.getTime()
    ) {
      const travelBefore = travelMinutesForTask(task);
      const travelAfter = task.travelMinutesAfter ?? 0;
      issues.push({
        code: "OUTSIDE_DAY",
        message:
          travelBefore > 0 && occupied.start.getTime() < options.dayStart.getTime()
            ? `${task.title} needs ${travelBefore} minutes to get there, which falls outside the planning day.`
            : travelAfter > 0 && occupied.end.getTime() > options.dayEnd.getTime()
              ? `${task.title} needs ${travelAfter} minutes after it for travel, which falls outside the planning day.`
              : `${task.title} falls outside the configured day.`,
        taskIds: [task.id],
      });
    }

    if (task.fixedStart && task.fixedEnd) {
      if (
        placement.start.getTime() !== task.fixedStart.getTime() ||
        placement.end.getTime() !== task.fixedEnd.getTime()
      ) {
        issues.push({
          code: "FIXED_TIME_MISMATCH",
          message: `${task.title} is fixed and cannot be moved.`,
          taskIds: [task.id],
        });
      }
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

    const weatherWindows = weatherWindowsForTask(task, options);
    if (
      weatherWindows &&
      !weatherWindows.some(
        (window) =>
          placement.start.getTime() >= window.start.getTime() &&
          placement.end.getTime() <= window.end.getTime(),
      )
    ) {
      issues.push({
        code: "WEATHER_UNSUITABLE",
        message: `${task.title} is outside the clear, dry weather windows available today.`,
        taskIds: [task.id],
      });
    }
  }

  for (let index = 0; index < sorted.length; index += 1) {
    for (let other = index + 1; other < sorted.length; other += 1) {
      const a = sorted[index];
      const b = sorted[other];
      const aTask = taskMap.get(a.taskId);
      const bTask = taskMap.get(b.taskId);
      if (!aTask || !bTask) continue;

      const aOccupied = occupiedInterval(a, aTask);
      const bOccupied = occupiedInterval(b, bTask);
      if (intervalsOverlap(a.start, a.end, b.start, b.end)) {
        issues.push({
          code: "OVERLAP",
          message: `${aTask.title} and ${bTask.title} overlap.`,
          taskIds: [a.taskId, b.taskId],
        });
      } else if (occupiedIntervalsOverlap(a, aTask, b, bTask)) {
        issues.push({
          code: "TRAVEL_OVERLAP",
          message: `${aTask.title} and ${bTask.title} do not leave enough required travel / interval time between them.`,
          taskIds: [a.taskId, b.taskId],
        });
      }
    }
  }

  if (options.requireMandatoryPlacement ?? true) {
    for (const task of tasks) {
      if (
        activeForScheduling(task) &&
        !task.optional &&
        !seen.has(task.id) &&
        !canWaitForWeather(task, options)
      ) {
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

function weatherWindowsForTask(
  task: Task,
  options: SchedulingOptions,
): SchedulingWindow[] | undefined {
  if (!task.weatherSensitive || task.weatherOverride || !options.weatherWindowsByTaskId) return undefined;
  if (!Object.prototype.hasOwnProperty.call(options.weatherWindowsByTaskId, task.id)) {
    return undefined;
  }
  return options.weatherWindowsByTaskId[task.id];
}

function canWaitForWeather(task: Task, options: SchedulingOptions): boolean {
  if (!task.weatherSensitive || task.weatherOverride || !options.weatherWindowsByTaskId) return false;
  return Object.prototype.hasOwnProperty.call(options.weatherWindowsByTaskId, task.id);
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
