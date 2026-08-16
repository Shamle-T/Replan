import { SCORE_WEIGHTS } from "./config";
import { minutesBetween, sortSchedule } from "./slots";
import type { OptimizationOptions, ScheduledTask, ScoreBreakdown, Task } from "./types";

function isActive(task: Task): boolean {
  return task.status === "planned" || task.status === "in-progress";
}

export function scoreSchedule(
  schedule: ScheduledTask[],
  tasks: Task[],
  options: OptimizationOptions,
): ScoreBreakdown {
  const placementsByTaskId = new Map(schedule.map((placement) => [placement.taskId, placement]));
  let priorityDelay = 0;
  let deadlinePressure = 0;
  let idleGaps = 0;
  let optionalUnscheduled = 0;

  for (const task of tasks) {
    if (!isActive(task)) continue;
    const placement = placementsByTaskId.get(task.id);

    if (!placement) {
      if (task.optional) optionalUnscheduled += SCORE_WEIGHTS.optionalUnscheduled;
      continue;
    }

    if (!task.fixedStart) {
      const earliestReference = task.earliestStart
        ? Math.max(task.earliestStart.getTime(), options.currentTime.getTime())
        : Math.max(options.dayStart.getTime(), options.currentTime.getTime());
      const delayHours = Math.max(0, (placement.start.getTime() - earliestReference) / 3_600_000);
      priorityDelay += delayHours * task.priority * SCORE_WEIGHTS.priorityDelayPerHour;
    }

    if (task.deadline) {
      const slackHours = Math.max(0, minutesBetween(placement.end, task.deadline) / 60);
      deadlinePressure +=
        (1 / (1 + slackHours)) * task.priority * SCORE_WEIGHTS.deadlinePressure;
    }
  }

  const future = sortSchedule(schedule.filter((placement) => placement.end > options.currentTime));
  if (future.length > 0) {
    idleGaps +=
      Math.max(0, minutesBetween(options.currentTime, future[0].start) / 60) *
      SCORE_WEIGHTS.idleGapPerHour;
  }

  for (let index = 1; index < future.length; index += 1) {
    idleGaps +=
      Math.max(0, minutesBetween(future[index - 1].end, future[index].start) / 60) *
      SCORE_WEIGHTS.idleGapPerHour;
  }

  const total = priorityDelay + deadlinePressure + idleGaps + optionalUnscheduled;

  return {
    priorityDelay: round(priorityDelay),
    deadlinePressure: round(deadlinePressure),
    idleGaps: round(idleGaps),
    optionalUnscheduled: round(optionalUnscheduled),
    disruption: 0,
    total: round(total),
  };
}

export function compareScores(left: ScoreBreakdown, right: ScoreBreakdown): number {
  return left.total - right.total;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
