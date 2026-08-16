import { generateLegalPlacements } from "./candidateGenerator";
import { buildScheduleReasons } from "./explain";
import { scoreSchedule } from "./scoring";
import { scheduleSignature, sortSchedule } from "./slots";
import type {
  OptimizationOptions,
  PreferredTimeResult,
  ScheduledTask,
  Task,
} from "./types";

export function findPreferredTime(
  taskId: string,
  tasks: Task[],
  currentSchedule: ScheduledTask[],
  options: OptimizationOptions,
): PreferredTimeResult {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return {
      status: "infeasible",
      result: {
        status: "infeasible",
        schedule: sortSchedule(currentSchedule),
        issues: [
          {
            code: "UNKNOWN_TASK",
            message: `Unknown task: ${taskId}.`,
            taskIds: [taskId],
          },
        ],
        reasons: [
          {
            code: "NO_LEGAL_PLACEMENT",
            taskId,
            summary: `Unknown task: ${taskId}.`,
          },
        ],
        unscheduledTaskIds: [taskId],
        searchNodes: 0,
        searchTruncated: false,
      },
    };
  }

  const existing = currentSchedule.find((item) => item.taskId === taskId);
  if (existing) {
    const schedule = sortSchedule(currentSchedule);
    return {
      status: "feasible",
      placement: existing,
      result: {
        status: "feasible",
        schedule,
        score: scoreSchedule(schedule, tasks, options),
        reasons: buildScheduleReasons(tasks, schedule, [], options),
        unscheduledTaskIds: [],
        searchNodes: 1,
        searchTruncated: false,
      },
    };
  }

  const candidates = generateLegalPlacements(task, currentSchedule, options, tasks);
  if (candidates.length === 0) {
    return {
      status: "infeasible",
      result: {
        status: "infeasible",
        schedule: sortSchedule(currentSchedule),
        issues: [
          {
            code: "MANDATORY_UNSCHEDULED",
            message: `${task.title} has no legal placement under its current constraints.`,
            taskIds: [task.id],
          },
        ],
        reasons: [
          {
            code: "NO_LEGAL_PLACEMENT",
            taskId: task.id,
            summary: `${task.title} has no legal placement under the current fixed commitments, deadline, and availability window.`,
          },
        ],
        unscheduledTaskIds: [task.id],
        searchNodes: candidates.length,
        searchTruncated: false,
      },
    };
  }

  let bestPlacement = candidates[0];
  let bestSchedule = sortSchedule([...currentSchedule, bestPlacement]);
  let bestScore = scoreSchedule(bestSchedule, tasks, options);

  for (const placement of candidates.slice(1)) {
    const schedule = sortSchedule([...currentSchedule, placement]);
    const score = scoreSchedule(schedule, tasks, options);
    if (
      score.total < bestScore.total ||
      (score.total === bestScore.total &&
        scheduleSignature(schedule) < scheduleSignature(bestSchedule))
    ) {
      bestPlacement = placement;
      bestSchedule = schedule;
      bestScore = score;
    }
  }

  const scheduledIds = new Set(bestSchedule.map((item) => item.taskId));
  const unscheduledTaskIds = tasks
    .filter(
      (item) =>
        (item.status === "planned" || item.status === "in-progress") &&
        !scheduledIds.has(item.id),
    )
    .map((item) => item.id)
    .sort();

  return {
    status: "feasible",
    placement: bestPlacement,
    result: {
      status: "feasible",
      schedule: bestSchedule,
      score: bestScore,
      reasons: buildScheduleReasons(tasks, bestSchedule, unscheduledTaskIds, options),
      unscheduledTaskIds,
      searchNodes: candidates.length,
      searchTruncated: false,
    },
  };
}