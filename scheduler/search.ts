import { DEFAULT_MAX_SEARCH_NODES } from "./config";
import { generateLegalPlacements } from "./candidateGenerator";
import { validateSchedule, validateTaskDefinitions } from "./constraints";
import { buildScheduleReasons } from "./explain";
import { compareScores, scoreSchedule } from "./scoring";
import { scheduleSignature, sortSchedule } from "./slots";
import { compareTaskUrgency } from "./urgency";
import type {
  FeasibleScheduleResult,
  InfeasibleScheduleResult,
  OptimizationOptions,
  ScheduledTask,
  ScheduleResult,
  Task,
  ValidationIssue,
} from "./types";

function isActive(task: Task): boolean {
  return task.status === "planned" || task.status === "in-progress";
}

function fixedPlacement(task: Task): ScheduledTask | null {
  if (!task.fixedStart || !task.fixedEnd) return null;
  return {
    taskId: task.id,
    start: new Date(task.fixedStart.getTime()),
    end: new Date(task.fixedEnd.getTime()),
  };
}

export function optimizeSchedule(
  tasks: Task[],
  options: OptimizationOptions,
): ScheduleResult {
  const definitionIssues = validateTaskDefinitions(tasks);
  if (definitionIssues.length > 0) {
    return infeasibleFromIssues(tasks, options.lockedSchedule ?? [], definitionIssues, 0, false);
  }

  const activeTasks = tasks.filter(isActive);
  const base = sortSchedule(
    (options.lockedSchedule ?? []).map((item) => ({
      taskId: item.taskId,
      start: new Date(item.start.getTime()),
      end: new Date(item.end.getTime()),
    })),
  );
  const baseTaskIds = new Set(base.map((item) => item.taskId));

  const fixed = activeTasks
    .filter((task) => task.fixedStart && task.fixedEnd && !baseTaskIds.has(task.id))
    .map(fixedPlacement)
    .filter((item): item is ScheduledTask => item !== null);

  const seeded = sortSchedule([...base, ...fixed]);
  const seededIssues = validateSchedule(seeded, tasks, {
    ...options,
    requireMandatoryPlacement: false,
  });
  if (seededIssues.length > 0) {
    return infeasibleFromIssues(tasks, seeded, seededIssues, 0, false);
  }

  const flexible = activeTasks
    .filter((task) => !task.fixedStart && !baseTaskIds.has(task.id))
    .sort((a, b) => compareTaskUrgency(a, b, options));

  const maxNodes = options.maxSearchNodes ?? DEFAULT_MAX_SEARCH_NODES;
  let searchNodes = 0;
  let searchTruncated = false;
  let best: FeasibleScheduleResult | null = null;

  const visit = (index: number, partial: ScheduledTask[]) => {
    if (searchNodes >= maxNodes) {
      searchTruncated = true;
      return;
    }
    searchNodes += 1;

    if (index >= flexible.length) {
      const finalSchedule = sortSchedule(partial);
      const issues = validateSchedule(finalSchedule, tasks, {
        ...options,
        requireMandatoryPlacement: true,
      });
      if (issues.length > 0) return;

      const scheduledIds = new Set(finalSchedule.map((item) => item.taskId));
      const unscheduledTaskIds = activeTasks
        .filter((task) => !scheduledIds.has(task.id))
        .map((task) => task.id)
        .sort();
      const score = scoreSchedule(finalSchedule, tasks, options);
      const candidate: FeasibleScheduleResult = {
        status: "feasible",
        schedule: finalSchedule,
        score,
        reasons: buildScheduleReasons(
          tasks,
          finalSchedule,
          unscheduledTaskIds,
          options,
        ),
        unscheduledTaskIds,
        searchNodes,
        searchTruncated,
      };

      if (!best) {
        best = candidate;
        return;
      }

      const scoreComparison = compareScores(candidate.score, best.score);
      if (
        scoreComparison < 0 ||
        (scoreComparison === 0 &&
          scheduleSignature(candidate.schedule) < scheduleSignature(best.schedule))
      ) {
        best = candidate;
      }
      return;
    }

    const task = flexible[index];
    const placements = generateLegalPlacements(task, partial, options, tasks).sort((a, b) => {
      const aScore = scoreSchedule([...partial, a], tasks, options).total;
      const bScore = scoreSchedule([...partial, b], tasks, options).total;
      return aScore - bScore || a.start.getTime() - b.start.getTime();
    });

    for (const placement of placements) {
      visit(index + 1, [...partial, placement]);
      if (searchNodes >= maxNodes) break;
    }

    if ((task.optional || canRemainOpenForWeather(task, options)) && searchNodes < maxNodes) {
      visit(index + 1, partial);
    }
  };

  visit(0, seeded);

  const chosen = best as FeasibleScheduleResult | null;
  if (chosen) {
    chosen.searchNodes = searchNodes;
    chosen.searchTruncated = searchTruncated;
    if (searchTruncated) {
      chosen.reasons.push({
        code: "SEARCH_LIMIT_REACHED",
        summary:
          "The search limit was reached; the returned schedule is the best deterministic feasible plan found within the configured search budget.",
        metadata: { maxSearchNodes: maxNodes },
      });
    }
    return chosen;
  }

  const diagnosticIssues: ValidationIssue[] = [];
  const placedIds = new Set(seeded.map((item) => item.taskId));
  for (const task of flexible) {
    if (task.optional || canRemainOpenForWeather(task, options)) continue;
    const legal = generateLegalPlacements(task, seeded, options, tasks);
    if (legal.length === 0) {
      diagnosticIssues.push({
        code: "MANDATORY_UNSCHEDULED",
        message: `${task.title} has no legal placement around the fixed/locked commitments and its hard constraints.`,
        taskIds: [task.id],
      });
    }
  }

  for (const task of activeTasks) {
    if (!task.optional && !canRemainOpenForWeather(task, options) && !placedIds.has(task.id) && !diagnosticIssues.some((issue) => issue.taskIds.includes(task.id))) {
      diagnosticIssues.push({
        code: "MANDATORY_UNSCHEDULED",
        message: `${task.title} could not be placed in a complete feasible combination.`,
        taskIds: [task.id],
      });
    }
  }

  if (diagnosticIssues.length === 0) {
    diagnosticIssues.push({
      code: "MANDATORY_UNSCHEDULED",
      message: "No complete feasible schedule exists for all mandatory tasks.",
      taskIds: activeTasks.filter((task) => !task.optional && !canRemainOpenForWeather(task, options)).map((task) => task.id),
    });
  }

  return infeasibleFromIssues(
    tasks,
    seeded,
    diagnosticIssues,
    searchNodes,
    searchTruncated,
  );
}

function canRemainOpenForWeather(task: Task, options: OptimizationOptions): boolean {
  if (!task.weatherSensitive || task.weatherOverride || !options.weatherWindowsByTaskId) return false;
  return Object.prototype.hasOwnProperty.call(options.weatherWindowsByTaskId, task.id);
}

function infeasibleFromIssues(
  tasks: Task[],
  schedule: ScheduledTask[],
  issues: ValidationIssue[],
  searchNodes: number,
  searchTruncated: boolean,
): InfeasibleScheduleResult {
  const scheduledIds = new Set(schedule.map((item) => item.taskId));
  const unscheduledTaskIds = tasks
    .filter((task) => isActive(task) && !scheduledIds.has(task.id))
    .map((task) => task.id)
    .sort();

  return {
    status: "infeasible",
    schedule: sortSchedule(schedule),
    issues,
    reasons: unscheduledTaskIds.map((taskId) => ({
      code: "NO_LEGAL_PLACEMENT" as const,
      taskId,
      summary: `${tasks.find((task) => task.id === taskId)?.title ?? taskId} could not be placed without violating a hard constraint.`,
    })),
    unscheduledTaskIds,
    searchNodes,
    searchTruncated,
  };
}
