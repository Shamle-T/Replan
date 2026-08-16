import { SCORE_WEIGHTS } from "./config";
import { minutesBetween, sortSchedule } from "./slots";
import { occupiedInterval } from "./occupancy";
import type {
  OptimizationOptions,
  ScheduledTask,
  ScoreBreakdown,
  Task,
} from "./types";

function activeTask(task: Task): boolean {
  return task.status === "planned" || task.status === "in-progress";
}

export function scoreSchedule(
  schedule: ScheduledTask[],
  tasks: Task[],
  options: OptimizationOptions,
): ScoreBreakdown {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const placementMap = new Map(schedule.map((item) => [item.taskId, item]));

  let priorityDelay = 0;
  let deadlinePressure = 0;
  let idleGaps = 0;
  let optionalUnscheduled = 0;
  let disruption = 0;

  for (const task of tasks) {
    if (!activeTask(task)) continue;
    const placement = placementMap.get(task.id);

    if (!placement) {
      if (task.optional) {
        optionalUnscheduled += SCORE_WEIGHTS.optionalUnscheduled;
      } else if (task.weatherSensitive && !task.weatherOverride) {
        // Mandatory outdoor work is allowed to remain open only so a genuinely
        // blocked forecast can be represented. When a legal weather window
        // exists, omitting the task must never beat scheduling it merely to
        // avoid a leading idle-gap penalty.
        optionalUnscheduled += SCORE_WEIGHTS.mandatoryWeatherUnscheduled;
      }
      continue;
    }

    if (!task.fixedStart) {
      const earliestReference = task.earliestStart
        ? Math.max(task.earliestStart.getTime(), options.currentTime.getTime())
        : Math.max(options.dayStart.getTime(), options.currentTime.getTime());
      const delayHours = Math.max(
        0,
        (placement.start.getTime() - earliestReference) / 3_600_000,
      );
      priorityDelay +=
        delayHours * task.priority * SCORE_WEIGHTS.priorityDelayPerHour;
    }

    if (task.deadline) {
      const slackHours = Math.max(0, minutesBetween(placement.end, task.deadline) / 60);
      const pressure = 1 / (1 + slackHours);
      deadlinePressure +=
        pressure * task.priority * SCORE_WEIGHTS.deadlinePressure;
    }
  }

  const future = sortSchedule(
    schedule.filter((item) => item.end > options.currentTime),
  );

  // Free time directly after "now" is just as important as a hole between two
  // later tasks. Without this leading-gap term, a replan could leave 20–30
  // minutes unused before the first remaining task while still receiving a
  // perfect idle-gap score. Penalising it consolidates free time toward the end
  // of the day instead of scattering it through the active schedule.
  if (future.length > 0) {
    const firstTask = taskMap.get(future[0].taskId);
    const firstOccupied = occupiedInterval(future[0], firstTask);
    const leadingGapHours = Math.max(
      0,
      minutesBetween(options.currentTime, firstOccupied.start) / 60,
    );
    idleGaps += leadingGapHours * SCORE_WEIGHTS.idleGapPerHour;
  }

  for (let index = 1; index < future.length; index += 1) {
    const previous = future[index - 1];
    const current = future[index];
    const previousTask = taskMap.get(previous.taskId);
    const currentTask = taskMap.get(current.taskId);
    const occupiedPrevious = occupiedInterval(previous, previousTask);
    const occupiedCurrent = occupiedInterval(current, currentTask);
    const gapHours = Math.max(0, minutesBetween(occupiedPrevious.end, occupiedCurrent.start) / 60);
    idleGaps += gapHours * SCORE_WEIGHTS.idleGapPerHour;
  }

  if (options.previousSchedule) {
    const previousMap = new Map(
      options.previousSchedule.map((item) => [item.taskId, item]),
    );
    for (const item of schedule) {
      const before = previousMap.get(item.taskId);
      if (!before) continue;
      const moved = Math.abs(minutesBetween(before.start, item.start));
      const resized = Math.abs(minutesBetween(before.end, item.end));
      disruption +=
        ((moved + resized) / 30) * SCORE_WEIGHTS.disruptionPerHalfHour;
    }
  }

  const total =
    priorityDelay +
    deadlinePressure +
    idleGaps +
    optionalUnscheduled +
    disruption;

  return {
    priorityDelay: round(priorityDelay),
    deadlinePressure: round(deadlinePressure),
    idleGaps: round(idleGaps),
    optionalUnscheduled: round(optionalUnscheduled),
    disruption: round(disruption),
    total: round(total),
  };
}

export function compareScores(a: ScoreBreakdown, b: ScoreBreakdown): number {
  return a.total - b.total;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
