import { minutesBetween } from "./slots";
import { scoreSchedule } from "./scoring";
import type {
  OptimizationOptions,
  ScheduledTask,
  ScheduleReason,
  Task,
} from "./types";

export function buildScheduleReasons(
  tasks: Task[],
  schedule: ScheduledTask[],
  unscheduledTaskIds: string[],
  options: OptimizationOptions,
): ScheduleReason[] {
  const reasons: ScheduleReason[] = [];
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const previousMap = new Map(
    (options.previousSchedule ?? []).map((item) => [item.taskId, item]),
  );

  for (const placement of schedule) {
    const task = taskMap.get(placement.taskId);
    if (!task || task.status === "completed") continue;

    if (task.fixedStart && task.fixedEnd) {
      reasons.push({
        code: "FIXED_COMMITMENT",
        taskId: task.id,
        summary: `${task.title} stays at its fixed commitment time.`,
      });
      continue;
    }

    if (task.priority >= 4) {
      reasons.push({
        code: "HIGH_PRIORITY_EARLY",
        taskId: task.id,
        summary: `${task.title} is kept relatively early because it has high priority.`,
        metadata: { priority: task.priority },
      });
    }

    if (task.deadline) {
      reasons.push({
        code: "BEFORE_DEADLINE",
        taskId: task.id,
        summary: `${task.title} finishes before its strict deadline with ${Math.max(
          0,
          Math.round(minutesBetween(placement.end, task.deadline)),
        )} minutes of slack.`,
        metadata: {
          slackMinutes: Math.max(
            0,
            Math.round(minutesBetween(placement.end, task.deadline)),
          ),
        },
      });
    }

    if (task.earliestStart || task.latestEnd) {
      reasons.push({
        code: "WITHIN_AVAILABILITY",
        taskId: task.id,
        summary: `${task.title} is placed inside its allowed availability window.`,
      });
    }

    const before = previousMap.get(task.id);
    if (
      before &&
      before.start.getTime() === placement.start.getTime() &&
      before.end.getTime() === placement.end.getTime()
    ) {
      reasons.push({
        code: "LOW_DISRUPTION",
        taskId: task.id,
        summary: `${task.title} keeps its existing time to avoid unnecessary disruption.`,
      });
    }
  }

  for (const taskId of unscheduledTaskIds) {
    const task = taskMap.get(taskId);
    if (!task) continue;
    const weatherChecked = Boolean(
      task.weatherSensitive &&
      !task.weatherOverride &&
      options.weatherWindowsByTaskId &&
      Object.prototype.hasOwnProperty.call(options.weatherWindowsByTaskId, task.id),
    );
    reasons.push({
      code: weatherChecked ? "WEATHER_HELD" : task.optional ? "OPTIONAL_OMITTED" : "NO_LEGAL_PLACEMENT",
      taskId,
      summary: weatherChecked
        ? `${task.title} is being kept open because no suitable clear, dry placement was selected today.`
        : task.optional
          ? `${task.title} is optional and was left unscheduled because better-feasibility choices took precedence.`
          : `${task.title} has no legal placement under the current hard constraints.`,
    });
  }

  return reasons;
}

export interface OptimizationChangeExplanation {
  taskId: string;
  summary: string;
  details: string[];
}

/**
 * Explain why a task moved during a whole-day optimization. The explanation is
 * derived from the same explicit scheduling inputs used by the deterministic
 * optimizer: priority, deadlines/windows, and the score breakdown. It does not
 * invent an AI rationale in the UI.
 */
export function explainOptimizationChanges(
  tasks: Task[],
  beforeSchedule: ScheduledTask[],
  afterSchedule: ScheduledTask[],
  options: OptimizationOptions,
): OptimizationChangeExplanation[] {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const beforeMap = new Map(beforeSchedule.map((item) => [item.taskId, item]));
  const afterMap = new Map(afterSchedule.map((item) => [item.taskId, item]));
  const beforeScore = scoreScheduleForExplanation(beforeSchedule, tasks, options);
  const afterScore = scoreScheduleForExplanation(afterSchedule, tasks, options);
  const scoreTie = Math.abs(beforeScore.total - afterScore.total) < 0.001;
  const idleImprovement = Math.max(0, beforeScore.idleGaps - afterScore.idleGaps);

  const beforeOrder = new Map(
    [...beforeSchedule]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((item, index) => [item.taskId, index]),
  );
  const afterOrder = new Map(
    [...afterSchedule]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((item, index) => [item.taskId, index]),
  );

  const explanations: OptimizationChangeExplanation[] = [];

  for (const [taskId, after] of afterMap) {
    const before = beforeMap.get(taskId);
    const task = taskMap.get(taskId);
    if (!before || !task || task.fixedStart) continue;
    const deltaMinutes = Math.round((after.start.getTime() - before.start.getTime()) / 60_000);
    if (deltaMinutes === 0) continue;

    const details: string[] = [];
    const swappedWith = tasks.find((other) => {
      if (other.id === task.id || other.fixedStart) return false;
      const beforeOther = beforeOrder.get(other.id);
      const afterOther = afterOrder.get(other.id);
      const beforeTask = beforeOrder.get(task.id);
      const afterTask = afterOrder.get(task.id);
      if (
        beforeOther === undefined || afterOther === undefined ||
        beforeTask === undefined || afterTask === undefined
      ) return false;
      return (beforeTask < beforeOther && afterTask > afterOther) ||
        (beforeTask > beforeOther && afterTask < afterOther);
    });

    if (swappedWith) {
      const relation = compareSchedulingPreference(task, swappedWith, options);
      if (relation === "task") {
        details.push(`${task.title} has stronger scheduling pressure than ${swappedWith.title}.`);
      } else if (relation === "other") {
        details.push(`${swappedWith.title} has stronger scheduling pressure, so ${task.title} moves around it.`);
      } else if (scoreTie) {
        details.push(`Both orders score the same, so Replan uses its deterministic tie-break to keep results stable.`);
      } else {
        details.push(`This ordering gives the lower total scheduling cost while both tasks remain legal.`);
      }
    }

    if (task.priority >= 4 && deltaMinutes < 0) {
      details.push(`${task.title} is high priority, so delaying it carries a larger penalty.`);
    }
    if (task.deadline && deltaMinutes < 0) {
      const slack = Math.max(0, Math.round(minutesBetween(after.end, task.deadline)));
      details.push(`Moving it earlier leaves ${slack} minutes of deadline slack.`);
    }
    if ((task.earliestStart || task.latestEnd) && swappedWith) {
      details.push(`The selected order also respects the tasks' availability windows.`);
    }
    if (idleImprovement > 0) {
      details.push(`The optimized day reduces avoidable idle-gap cost.`);
    }

    const direction = deltaMinutes < 0 ? "earlier" : "later";
    const amount = formatExplanationMinutes(Math.abs(deltaMinutes));
    let summary = `${task.title} moved ${amount} ${direction}.`;
    if (swappedWith) {
      const relation = compareSchedulingPreference(task, swappedWith, options);
      if (relation === "task") {
        summary = `${task.title} moved ahead of ${swappedWith.title} because it has stronger scheduling pressure.`;
      } else if (relation === "other") {
        summary = `${task.title} moved behind ${swappedWith.title} because ${swappedWith.title} has stronger scheduling pressure.`;
      } else if (scoreTie) {
        summary = `${task.title} and ${swappedWith.title} are equivalent under the score; a deterministic tie-break chose this order.`;
      } else {
        summary = `${task.title} and ${swappedWith.title} switched because this order produces the lower overall schedule cost.`;
      }
    } else if (idleImprovement > 0 && deltaMinutes < 0) {
      summary = `${task.title} moved ${amount} earlier to reduce avoidable idle time.`;
    }

    explanations.push({ taskId, summary, details: unique(details) });
  }

  return explanations;
}

function compareSchedulingPreference(
  a: Task,
  b: Task,
  options: OptimizationOptions,
): "task" | "other" | "tie" {
  if (a.optional !== b.optional) return a.optional ? "other" : "task";
  const aDeadline = (a.deadline ?? options.dayEnd).getTime();
  const bDeadline = (b.deadline ?? options.dayEnd).getTime();
  if (aDeadline !== bDeadline) return aDeadline < bDeadline ? "task" : "other";

  const aLatest = a.latestEnd ?? a.deadline ?? options.dayEnd;
  const bLatest = b.latestEnd ?? b.deadline ?? options.dayEnd;
  const aEarliest = a.earliestStart ?? options.dayStart;
  const bEarliest = b.earliestStart ?? options.dayStart;
  const aWindow = minutesBetween(aEarliest, aLatest);
  const bWindow = minutesBetween(bEarliest, bLatest);
  if (aWindow !== bWindow) return aWindow < bWindow ? "task" : "other";
  if (a.priority !== b.priority) return a.priority > b.priority ? "task" : "other";
  if (a.durationMinutes !== b.durationMinutes) return a.durationMinutes > b.durationMinutes ? "task" : "other";
  return "tie";
}

function formatExplanationMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} minute${rounded === 1 ? "" : "s"}`;
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  const hourLabel = `${hours} hour${hours === 1 ? "" : "s"}`;
  if (remainder === 0) return hourLabel;
  return `${hourLabel} ${remainder} minute${remainder === 1 ? "" : "s"}`;
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

// Kept local to the explanation module so callers receive scheduler-owned
// reasoning without coupling React to score internals.
function scoreScheduleForExplanation(
  schedule: ScheduledTask[],
  tasks: Task[],
  options: OptimizationOptions,
) {
  // Lazy require would undermine ESM typing; this indirection is replaced by
  // the normal static import below during compilation.
  return scoreSchedule(schedule, tasks, options);
}
