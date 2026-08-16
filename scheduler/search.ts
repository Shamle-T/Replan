import { DEFAULT_MAX_SEARCH_NODES } from "./config";
import { generateLegalPlacements } from "./candidateGenerator";
import { validateSchedule, validateTaskDefinitions } from "./constraints";
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

export function optimizeSchedule(tasks: Task[], options: OptimizationOptions): ScheduleResult {
  const definitionIssues = validateTaskDefinitions(tasks);
  if (definitionIssues.length > 0) {
    return infeasibleFromIssues(tasks, [], definitionIssues, 0, false);
  }

  const activeTasks = tasks.filter(isActive);
  const lockedSchedule = sortSchedule(
    (options.lockedSchedule ?? []).map((placement) => ({
      taskId: placement.taskId,
      start: new Date(placement.start.getTime()),
      end: new Date(placement.end.getTime()),
    })),
  );
  const lockedTaskIds = new Set(lockedSchedule.map((placement) => placement.taskId));
  const fixedSchedule = activeTasks
    .filter((task) => task.fixedStart && task.fixedEnd && !lockedTaskIds.has(task.id))
    .map(fixedPlacement)
    .filter((placement): placement is ScheduledTask => placement !== null);
  const seededSchedule = sortSchedule([...lockedSchedule, ...fixedSchedule]);
  const seededIssues = validateSchedule(seededSchedule, tasks, {
    ...options,
    requireMandatoryPlacement: false,
  });
  if (seededIssues.length > 0) {
    return infeasibleFromIssues(tasks, seededSchedule, seededIssues, 0, false);
  }

  const flexibleTasks = activeTasks
    .filter((task) => !task.fixedStart && !lockedTaskIds.has(task.id))
    .sort((left, right) => compareTaskUrgency(left, right, options));
  const maxSearchNodes = options.maxSearchNodes ?? DEFAULT_MAX_SEARCH_NODES;
  let searchNodes = 0;
  let searchTruncated = false;
  let best: FeasibleScheduleResult | null = null;

  const visit = (index: number, partialSchedule: ScheduledTask[]): void => {
    if (searchNodes >= maxSearchNodes) {
      searchTruncated = true;
      return;
    }
    searchNodes += 1;

    if (index === flexibleTasks.length) {
      const schedule = sortSchedule(partialSchedule);
      const issues = validateSchedule(schedule, tasks, {
        ...options,
        requireMandatoryPlacement: true,
      });
      if (issues.length > 0) return;

      const scheduledTaskIds = new Set(schedule.map((placement) => placement.taskId));
      const unscheduledTaskIds = activeTasks
        .filter((task) => !scheduledTaskIds.has(task.id))
        .map((task) => task.id)
        .sort();
      const candidate: FeasibleScheduleResult = {
        status: "feasible",
        schedule,
        score: scoreSchedule(schedule, tasks, options),
        reasons: [],
        unscheduledTaskIds,
        searchNodes,
        searchTruncated,
      };

      if (
        !best ||
        compareScores(candidate.score, best.score) < 0 ||
        (compareScores(candidate.score, best.score) === 0 &&
          scheduleSignature(candidate.schedule) < scheduleSignature(best.schedule))
      ) {
        best = candidate;
      }
      return;
    }

    const task = flexibleTasks[index];
    const placements = generateLegalPlacements(task, partialSchedule, options).sort((left, right) => {
      const byScore = compareScores(
        scoreSchedule([...partialSchedule, left], tasks, options),
        scoreSchedule([...partialSchedule, right], tasks, options),
      );
      return byScore || left.start.getTime() - right.start.getTime();
    });

    for (const placement of placements) {
      visit(index + 1, [...partialSchedule, placement]);
      if (searchNodes >= maxSearchNodes) break;
    }

    if (task.optional && searchNodes < maxSearchNodes) {
      visit(index + 1, partialSchedule);
    }
  };

  visit(0, seededSchedule);

  const chosen = best as FeasibleScheduleResult | null;
  if (chosen) {
    chosen.searchNodes = searchNodes;
    chosen.searchTruncated = searchTruncated;
    return chosen;
  }

  const diagnosticIssues = mandatoryPlacementIssues(
    tasks,
    flexibleTasks,
    seededSchedule,
    options,
  );
  return infeasibleFromIssues(tasks, seededSchedule, diagnosticIssues, searchNodes, searchTruncated);
}

function mandatoryPlacementIssues(
  tasks: Task[],
  flexibleTasks: Task[],
  seededSchedule: ScheduledTask[],
  options: OptimizationOptions,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const task of flexibleTasks) {
    if (task.optional || generateLegalPlacements(task, seededSchedule, options).length > 0) continue;

    issues.push({
      code: "MANDATORY_UNSCHEDULED",
      message: `${task.title} has no legal placement around fixed commitments and hard constraints.`,
      taskIds: [task.id],
    });
  }

  if (issues.length > 0) return issues;

  const scheduledTaskIds = new Set(seededSchedule.map((placement) => placement.taskId));
  for (const task of tasks) {
    if (isActive(task) && !task.optional && !scheduledTaskIds.has(task.id)) {
      issues.push({
        code: "MANDATORY_UNSCHEDULED",
        message: `${task.title} could not be placed in a complete feasible combination.`,
        taskIds: [task.id],
      });
    }
  }

  return issues;
}

function infeasibleFromIssues(
  tasks: Task[],
  schedule: ScheduledTask[],
  issues: ValidationIssue[],
  searchNodes: number,
  searchTruncated: boolean,
): InfeasibleScheduleResult {
  const scheduledTaskIds = new Set(schedule.map((placement) => placement.taskId));
  const unscheduledTaskIds = tasks
    .filter((task) => isActive(task) && !scheduledTaskIds.has(task.id))
    .map((task) => task.id)
    .sort();

  return {
    status: "infeasible",
    schedule: sortSchedule(schedule),
    issues,
    reasons: [],
    unscheduledTaskIds,
    searchNodes,
    searchTruncated,
  };
}
