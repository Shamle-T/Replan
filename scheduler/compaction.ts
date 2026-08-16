import { generateLegalPlacements } from "./candidateGenerator";
import { validateSchedule } from "./constraints";
import {
  occupiedInterval,
  travelMinutesForTask,
} from "./occupancy";
import { addMinutes, maxDate, sortSchedule } from "./slots";
import type {
  OptimizationOptions,
  ScheduledTask,
  Task,
} from "./types";

/**
 * Left-compacts the already-selected live schedule without changing the
 * chronological order chosen by the optimizer.
 *
 * This is intentionally a live-replan finishing pass, not the primary search
 * algorithm. The global optimizer still decides which tasks belong in which
 * side of fixed commitments and which ordering is best. Once that feasible
 * ordering exists, this pass removes avoidable holes between consecutive
 * movable tasks by shifting each flexible placement as early as hard
 * constraints allow.
 *
 * The pass is safe because a task only moves earlier (never later) and never
 * crosses the preceding item in the selected chronological order. Therefore a
 * moved task cannot create a new collision with an item that originally came
 * after it; fixed/locked commitments are also supplied as blockers while each
 * candidate is checked.
 */
export function compactScheduleForward(
  schedule: ScheduledTask[],
  tasks: Task[],
  options: OptimizationOptions,
): ScheduledTask[] {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const sorted = sortSchedule(schedule).map(clonePlacement);
  const lockedIds = new Set((options.lockedSchedule ?? []).map((item) => item.taskId));

  const immutable = sorted.filter((placement) => {
    const task = taskMap.get(placement.taskId);
    if (!task) return true;
    return (
      Boolean(task.fixedStart && task.fixedEnd) ||
      task.status === "completed" ||
      lockedIds.has(task.id)
    );
  });

  const immutableIds = new Set(immutable.map((item) => item.taskId));
  const blockers: ScheduledTask[] = immutable.map(clonePlacement);
  const chosenByTaskId = new Map<string, ScheduledTask>();

  let previousChosen: ScheduledTask | null = null;

  for (const original of sorted) {
    const task = taskMap.get(original.taskId);
    if (!task) {
      previousChosen = original;
      continue;
    }

    if (immutableIds.has(task.id)) {
      chosenByTaskId.set(task.id, clonePlacement(original));
      previousChosen = clonePlacement(original);
      continue;
    }

    // Cancelled/skipped tasks should normally already be absent, but never
    // resurrect them if a stale placement reaches this utility.
    if (task.status !== "planned" && task.status !== "in-progress") {
      continue;
    }

    const alreadyChosen = [...chosenByTaskId.values()].filter(
      (item) => !immutableIds.has(item.taskId),
    );
    const protectedSchedule = dedupeByTaskId([...blockers, ...alreadyChosen]);

    const previousOccupiedEnd = previousChosen
      ? occupiedInterval(previousChosen, taskMap.get(previousChosen.taskId)).end
      : options.currentTime;
    const earliestOccupiedStart = maxDate(options.currentTime, previousOccupiedEnd);
    const travelBefore = travelMinutesForTask(task);
    const exactStart = maxDate(
      addMinutes(earliestOccupiedStart, travelBefore),
      addMinutes(options.dayStart, travelBefore),
      task.earliestStart ?? options.dayStart,
    );

    const exactCandidate: ScheduledTask = {
      taskId: task.id,
      start: exactStart,
      end: addMinutes(exactStart, task.durationMinutes),
    };

    const generated = generateLegalPlacements(
      task,
      protectedSchedule,
      options,
      tasks,
    );

    // Exact live-boundary placement is deliberately considered alongside
    // legal occupied boundaries. This lets a skip/cancel/early-finish at 10:37
    // immediately reclaim 10:37 rather than waiting for a rounded time.
    const candidates = dedupePlacements([exactCandidate, ...generated, original])
      // A newly selected relax window may begin after a preview placement that
      // was generated at the live boundary. In that case, allow the event to
      // move later; normal compaction still only moves future events earlier.
      .filter(
        (candidate) =>
          original.start.getTime() < options.currentTime.getTime() ||
          candidate.start.getTime() <= original.start.getTime(),
      )
      .filter((candidate) => {
        const occupied = occupiedInterval(candidate, task);
        return occupied.start.getTime() >= earliestOccupiedStart.getTime();
      })
      .filter((candidate) =>
        validateSchedule([...protectedSchedule, candidate], tasks, {
          ...options,
          requireMandatoryPlacement: false,
        }).length === 0,
      )
      .sort((a, b) =>
        a.start.getTime() - b.start.getTime() ||
        a.end.getTime() - b.end.getTime(),
      );

    const chosen = clonePlacement(candidates[0] ?? original);
    chosenByTaskId.set(task.id, chosen);
    previousChosen = chosen;
  }

  const compacted = sortSchedule(
    sorted
      .filter((item) => chosenByTaskId.has(item.taskId))
      .map((item) => clonePlacement(chosenByTaskId.get(item.taskId)!)),
  );

  // Defensive final guard. A live compaction pass must never turn a valid
  // optimizer result into an invalid schedule. If anything unexpected slips
  // through, keep the original feasible arrangement.
  const issues = validateSchedule(compacted, tasks, {
    ...options,
    requireMandatoryPlacement: false,
  });
  return issues.length === 0 ? compacted : sorted;
}

function clonePlacement(item: ScheduledTask): ScheduledTask {
  return {
    taskId: item.taskId,
    start: new Date(item.start.getTime()),
    end: new Date(item.end.getTime()),
  };
}

function dedupeByTaskId(schedule: ScheduledTask[]): ScheduledTask[] {
  const byTask = new Map<string, ScheduledTask>();
  for (const item of schedule) byTask.set(item.taskId, clonePlacement(item));
  return [...byTask.values()];
}

function dedupePlacements(schedule: ScheduledTask[]): ScheduledTask[] {
  const byKey = new Map<string, ScheduledTask>();
  for (const item of schedule) {
    const key = `${item.taskId}:${item.start.getTime()}:${item.end.getTime()}`;
    byKey.set(key, clonePlacement(item));
  }
  return [...byKey.values()];
}
