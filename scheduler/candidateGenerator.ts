import {
  addMinutes,
  maxDate,
  minDate,
} from "./slots";
import { bufferMinutesAfterTask, occupiedInterval, placementConflictsWithSchedule, travelMinutesAfterTask, travelMinutesForTask } from "./occupancy";
import type {
  ScheduledTask,
  SchedulingOptions,
  SchedulingWindow,
  Task,
} from "./types";

export function getTaskWindow(
  task: Task,
  options: SchedulingOptions,
): { start: Date; end: Date } | null {
  const travelMinutes = travelMinutesForTask(task);
  const afterMinutes = travelMinutesAfterTask(task) + bufferMinutesAfterTask(task);
  const baseStart = maxDate(
    addMinutes(options.dayStart, travelMinutes),
    addMinutes(options.currentTime, travelMinutes),
  );
  const rawStart = task.earliestStart
    ? maxDate(baseStart, task.earliestStart)
    : baseStart;
  const dayEndForTask = addMinutes(options.dayEnd, -afterMinutes);
  const rawEnd = task.latestEnd
    ? minDate(dayEndForTask, task.latestEnd)
    : dayEndForTask;
  const deadlineBound = task.deadline
    ? minDate(rawEnd, task.deadline)
    : rawEnd;
  // Keep the raw legal boundary. Candidate generation remains minute-flexible
  // and adds occupied boundaries separately so no artificial grid is needed.
  const start = rawStart;

  if (addMinutes(start, task.durationMinutes) > deadlineBound) return null;
  return { start, end: deadlineBound };
}

export function generateLegalPlacements(
  task: Task,
  existingSchedule: ScheduledTask[],
  options: SchedulingOptions,
  allTasks: Task[] = [task],
): ScheduledTask[] {
  if (task.fixedStart && task.fixedEnd) {
    const placement: ScheduledTask = {
      taskId: task.id,
      start: new Date(task.fixedStart.getTime()),
      end: new Date(task.fixedEnd.getTime()),
    };
    return placementConflictsWithSchedule(placement, task, existingSchedule, allTasks)
      ? []
      : [placement];
  }

  const window = getTaskWindow(task, options);
  if (!window) return [];

  const weatherWindows = getWeatherWindows(task, options);
  if (weatherWindows && weatherWindows.length === 0) return [];

  const taskMap = new Map(allTasks.map((item) => [item.id, item]));
  const travelBefore = travelMinutesForTask(task);
  const occupiedAfter = travelMinutesAfterTask(task) + bufferMinutesAfterTask(task);

  // Every candidate is an exact legal boundary. The task window handles the
  // current/earliest start, while occupied boundaries let work sit directly
  // before or after fixed work, travel, buffers, and already placed tasks.
  const starts = [
    window.start,
    ...(weatherWindows?.flatMap((weatherWindow) => [
      weatherWindow.start,
      addMinutes(weatherWindow.end, -task.durationMinutes),
    ]) ?? []),
    ...existingSchedule.flatMap((existing) => {
      const existingTask = taskMap.get(existing.taskId);
      const occupied = occupiedInterval(existing, existingTask);
      return [
        addMinutes(occupied.end, travelBefore),
        addMinutes(occupied.start, -(task.durationMinutes + occupiedAfter)),
      ];
    }),
  ];

  const uniqueStarts = [...new Map(starts.map((start) => [start.getTime(), start])).values()]
    .filter((start) => start.getTime() >= window.start.getTime())
    .filter((start) => addMinutes(start, task.durationMinutes).getTime() <= window.end.getTime())
    .sort((a, b) => a.getTime() - b.getTime());

  return uniqueStarts
    .map((start) => ({
      taskId: task.id,
      start,
      end: addMinutes(start, task.durationMinutes),
    }))
    .filter((candidate) =>
      weatherWindows ? fitsAnyWindow(candidate, weatherWindows) : true,
    )
    .filter(
      (candidate) =>
        !placementConflictsWithSchedule(candidate, task, existingSchedule, allTasks),
    );
}

function getWeatherWindows(
  task: Task,
  options: SchedulingOptions,
): SchedulingWindow[] | undefined {
  if (!task.weatherSensitive || task.weatherOverride || !options.weatherWindowsByTaskId) return undefined;
  if (!Object.prototype.hasOwnProperty.call(options.weatherWindowsByTaskId, task.id)) {
    return undefined;
  }
  return options.weatherWindowsByTaskId[task.id];
}

function fitsAnyWindow(
  placement: ScheduledTask,
  windows: SchedulingWindow[],
): boolean {
  return windows.some(
    (window) =>
      placement.start.getTime() >= window.start.getTime() &&
      placement.end.getTime() <= window.end.getTime(),
  );
}
