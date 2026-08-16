import { compactScheduleForward } from "./compaction";
import { validateSchedule } from "./constraints";
import { diffSchedules } from "./diff";
import { optimizeSchedule } from "./search";
import { scoreSchedule } from "./scoring";
import { addMinutes, minutesBetween, sortSchedule } from "./slots";
import { occupiedInterval, travelMinutesForTask } from "./occupancy";
import type {
  OptimizationOptions,
  PostTaskBreak,
  PostTaskBreakMinutes,
  ScheduleChange,
  ScheduledTask,
  ScheduleReason,
  ScheduleResult,
  Task,
} from "./types";

export function replanSchedule(
  tasks: Task[],
  currentSchedule: ScheduledTask[],
  change: ScheduleChange,
  options: OptimizationOptions,
): ScheduleResult {
  const updatedTasks = tasks.map((task) => ({ ...task }));
  const target = updatedTasks.find((task) => task.id === change.taskId);
  const targetPlacement = currentSchedule.find(
    (placement) => placement.taskId === change.taskId,
  );

  if (!target) {
    return {
      status: "infeasible",
      schedule: sortSchedule(currentSchedule),
      issues: [
        {
          code: "UNKNOWN_TASK",
          message: `Unknown task: ${change.taskId}.`,
          taskIds: [change.taskId],
        },
      ],
      reasons: [
        {
          code: "NO_LEGAL_PLACEMENT",
          taskId: change.taskId,
          summary: "The requested schedule change refers to an unknown task.",
        },
      ],
      unscheduledTaskIds: [],
      searchNodes: 0,
      searchTruncated: false,
    };
  }

  let changedSchedule = currentSchedule.map((item) => ({
    taskId: item.taskId,
    start: new Date(item.start.getTime()),
    end: new Date(item.end.getTime()),
  }));
  const eventReasons: ScheduleReason[] = [];
  let completedEarly = false;

  if (change.type === "TASK_COMPLETED") {
    target.status = "completed";
    if (target.fixedStart && target.fixedEnd) {
      target.fixedEnd = new Date(change.actualEnd.getTime());
    }
    if (targetPlacement) {
      changedSchedule = changedSchedule.map((placement) =>
        placement.taskId === target.id
          ? { ...placement, end: new Date(change.actualEnd.getTime()) }
          : placement,
      );
      completedEarly = change.actualEnd.getTime() < targetPlacement.end.getTime();
      eventReasons.push({
        code: completedEarly ? "REPLAN_COMPLETED_EARLY" : "REPLAN_COMPLETED",
        taskId: target.id,
        summary: completedEarly
          ? `${target.title} finished early, so the released time can be reused.`
          : `${target.title} was marked complete and the remaining day was reconsidered.`,
      });
    }
  }

  if (change.type === "TASK_OVERRUN") {
    target.status = "in-progress";
    if (target.fixedStart && target.fixedEnd) {
      target.fixedEnd = new Date(change.newExpectedEnd.getTime());
    }
    if (targetPlacement) {
      target.durationMinutes = Math.max(
        1,
        Math.round(minutesBetween(targetPlacement.start, change.newExpectedEnd)),
      );
      changedSchedule = changedSchedule.map((placement) =>
        placement.taskId === target.id
          ? { ...placement, end: new Date(change.newExpectedEnd.getTime()) }
          : placement,
      );
      const deltaMinutes = minutesBetween(targetPlacement.end, change.newExpectedEnd);
      eventReasons.push({
        code: "REPLAN_OVERRUN",
        taskId: target.id,
        summary:
          deltaMinutes >= 0
            ? `${target.title} now needs ${Math.round(deltaMinutes)} more minutes, so the remaining work is adjusted around it.`
            : `${target.title}'s extra time was reduced by ${Math.abs(Math.round(deltaMinutes))} minutes, so the remaining plan was checked again.`,
      });
    }
  }

  if (change.type === "TASK_CANCELLED") {
    target.status = "cancelled";
    changedSchedule = changedSchedule.filter(
      (placement) => placement.taskId !== target.id,
    );
    eventReasons.push({
      code: "REPLAN_CANCELLED",
      taskId: target.id,
      summary: `${target.title} was cancelled, releasing its reserved time.`,
    });
  }

  if (change.type === "TASK_SKIPPED") {
    target.status = "skipped";
    changedSchedule = changedSchedule.filter(
      (placement) => placement.taskId !== target.id,
    );
    eventReasons.push({
      code: "REPLAN_SKIPPED",
      taskId: target.id,
      summary: `${target.title} was skipped, so its time can be reused.`,
    });
  }

  const lockedSchedule = changedSchedule.filter((placement) => {
    const task = updatedTasks.find((item) => item.id === placement.taskId);
    if (!task || task.status === "cancelled" || task.status === "skipped") return false;
    return (
      task.status === "completed" ||
      placement.start.getTime() <= options.currentTime.getTime()
    );
  });

  let result =
    completedEarly && change.type === "TASK_COMPLETED" && targetPlacement
      ? optimizeAfterEarlyCompletion(
          updatedTasks,
          currentSchedule,
          lockedSchedule,
          change.actualEnd,
          target.id,
          options,
        )
      : optimizeSchedule(updatedTasks, {
          ...options,
          lockedSchedule,
          // Completion/cancellation/skipping creates genuinely new free time.
          // Re-pack the remaining flexible work from the current moment instead
          // of paying a disruption cost for keeping avoidable gaps. Overruns
          // still retain the previous-plan preference because they represent a
          // delay rather than newly released capacity.
          // Live replanning should keep the user's established task order
          // unless a hard constraint makes that impossible. The final
          // compaction pass is responsible for removing gaps, so disruption
          // scoring can safely remain enabled here without preserving idle
          // holes.
          previousSchedule: currentSchedule,
        });

  // Completing, cancelling, or skipping a task is a factual update, not a
  // scheduling preference. If the optimizer cannot find a better full-day
  // arrangement, preserve the remaining accepted plan instead of blocking the
  // user's factual update with an "infeasible" result.
  if (
    result.status === "infeasible" &&
    (change.type === "TASK_COMPLETED" ||
      change.type === "TASK_CANCELLED" ||
      change.type === "TASK_SKIPPED")
  ) {
    const factualSchedule = sortSchedule(changedSchedule);
    const factualIssues = validateSchedule(factualSchedule, updatedTasks, {
      ...options,
      requireMandatoryPlacement: true,
    });

    if (factualIssues.length === 0) {
      const scheduledIds = new Set(factualSchedule.map((item) => item.taskId));
      const unscheduledTaskIds = updatedTasks
        .filter(
          (task) =>
            (task.status === "planned" || task.status === "in-progress") &&
            !scheduledIds.has(task.id),
        )
        .map((task) => task.id)
        .sort();

      result = {
        status: "feasible",
        schedule: factualSchedule,
        score: scoreSchedule(factualSchedule, updatedTasks, {
          ...options,
          previousSchedule: currentSchedule,
        }),
        reasons: [
          {
            code:
              change.type === "TASK_COMPLETED"
                ? completedEarly
                  ? "REPLAN_COMPLETED_EARLY"
                  : "REPLAN_COMPLETED"
                : change.type === "TASK_CANCELLED"
                  ? "REPLAN_CANCELLED"
                  : "REPLAN_SKIPPED",
            taskId: target.id,
            summary:
              change.type === "TASK_COMPLETED"
                ? `${target.title} is complete. The remaining accepted plan is still safe, so Replan kept it rather than blocking the update.`
                : change.type === "TASK_CANCELLED"
                  ? `${target.title} is cancelled. The remaining accepted plan is still safe.`
                  : `${target.title} is skipped. The remaining accepted plan is still safe.`,
          },
        ],
        unscheduledTaskIds,
        searchNodes: result.searchNodes,
        searchTruncated: result.searchTruncated,
      };

      if (completedEarly && change.type === "TASK_COMPLETED") {
        const preferred = options.postTaskBreakMinutes ?? 10;
        const taskMap = new Map(updatedTasks.map((task) => [task.id, task]));
        const nextOccupiedStart = factualSchedule
          .filter(
            (placement) =>
              placement.taskId !== target.id &&
              placement.end.getTime() > change.actualEnd.getTime(),
          )
          .map((placement) => occupiedInterval(placement, taskMap.get(placement.taskId)).start)
          .filter((date) => date.getTime() >= change.actualEnd.getTime())
          .sort((a, b) => a.getTime() - b.getTime())[0];
        const availableMinutes = nextOccupiedStart
          ? Math.max(0, Math.floor(minutesBetween(change.actualEnd, nextOccupiedStart)))
          : preferred;
        const relaxMinutes = Math.min(preferred, availableMinutes);
        if (relaxMinutes >= 5) {
          result = withPostTaskBreak(
            result,
            preferred,
            relaxMinutes,
            change.actualEnd,
          );
        }
      }
    }
  }

  // Final live-replan pass: once the optimizer has chosen a feasible ordering,
  // close every avoidable hole between the remaining flexible tasks. This is
  // deliberately applied after all change types (overrun, early completion,
  // cancel, skip) so repeated live updates cannot leave a stale gap merely
  // because several downstream tasks would all need to move together.
  if (result.status === "feasible") {
    const compactionTime = result.postTaskBreak?.end ?? options.currentTime;
    const compactionOptions: OptimizationOptions = {
      ...options,
      currentTime: compactionTime,
      lockedSchedule,
      previousSchedule: undefined,
    };
    const compacted = compactScheduleForward(
      result.schedule,
      updatedTasks,
      compactionOptions,
    );
    const compactIssues = validateSchedule(compacted, updatedTasks, {
      ...compactionOptions,
      requireMandatoryPlacement: true,
    });
    if (compactIssues.length === 0) {
      result = {
        ...result,
        schedule: compacted,
        score: scoreSchedule(compacted, updatedTasks, {
          ...options,
          currentTime: compactionTime,
          lockedSchedule,
          previousSchedule: currentSchedule,
        }),
      };
    }
  }

  const diff = diffSchedules(currentSchedule, result.schedule);
  const breakReasons: ScheduleReason[] = result.postTaskBreak
    ? [
        {
          code: "POST_TASK_BREAK",
          taskId: target.id,
          summary:
            result.postTaskBreak.minutes === result.postTaskBreak.preferredMinutes
              ? `A ${result.postTaskBreak.minutes}-minute relax window is kept before the next task.`
              : `The relax window was shortened to ${result.postTaskBreak.minutes} minutes to protect the rest of the plan.`,
          metadata: {
            minutes: result.postTaskBreak.minutes,
            preferredMinutes: result.postTaskBreak.preferredMinutes,
          },
        },
      ]
    : [];
  const diffReasons: ScheduleReason[] = diff
    .filter((entry) => entry.type !== "unchanged")
    .map((entry) => {
      const task = updatedTasks.find((item) => item.id === entry.taskId);
      const title = task?.title ?? entry.taskId;
      if (entry.type === "moved") {
        return {
          code: "SCHEDULE_MOVED" as const,
          taskId: entry.taskId,
          summary: `${title} moved ${Math.abs(entry.deltaMinutes ?? 0)} minutes ${
            (entry.deltaMinutes ?? 0) < 0 ? "earlier" : "later"
          }.`,
          metadata: { deltaMinutes: entry.deltaMinutes ?? 0 },
        };
      }
      if (entry.type === "removed") {
        return {
          code: "SCHEDULE_REMOVED" as const,
          taskId: entry.taskId,
          summary: `${title} was removed from the remaining plan.`,
        };
      }
      return {
        code: "SCHEDULE_ADDED" as const,
        taskId: entry.taskId,
        summary: `${title} changed in the revised plan.`,
      };
    });

  return {
    ...result,
    reasons: [...eventReasons, ...breakReasons, ...result.reasons, ...diffReasons],
    diff,
  };
}

function optimizeAfterEarlyCompletion(
  tasks: Task[],
  currentSchedule: ScheduledTask[],
  lockedSchedule: ScheduledTask[],
  actualEnd: Date,
  completedTaskId: string,
  options: OptimizationOptions,
): ScheduleResult {
  const preferredMinutes = options.postTaskBreakMinutes ?? 10;

  // Look for the first *flexible* remaining task, not merely the first calendar
  // item. If a fixed meeting is next but a short flexible task can fit before
  // it, Replan should be able to reclaim that newly released window.
  const nextOriginalPlacement = sortSchedule(currentSchedule).find((placement) => {
    if (placement.taskId === completedTaskId) return false;
    if (placement.start.getTime() < actualEnd.getTime()) return false;
    const task = tasks.find((item) => item.id === placement.taskId);
    return (
      Boolean(task) &&
      !task!.fixedStart &&
      (task!.status === "planned" || task!.status === "in-progress")
    );
  });

  const fixedPlacements = tasks
    .filter(
      (task) =>
        (task.status === "planned" || task.status === "in-progress") &&
        task.fixedStart &&
        task.fixedEnd &&
        !lockedSchedule.some((item) => item.taskId === task.id),
    )
    .map((task) => ({
      taskId: task.id,
      start: new Date(task.fixedStart!.getTime()),
      end: new Date(task.fixedEnd!.getTime()),
    }));

  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const nextFixedStart = fixedPlacements
    .map((placement) => occupiedInterval(placement, taskMap.get(placement.taskId)).start)
    .filter((start) => start.getTime() >= actualEnd.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0];

  let best:
    | {
        result: ScheduleResult;
        breakMinutes: number;
        activeIdleMinutes: number;
        score: number;
        preservesNext: boolean;
      }
    | null = null;

  for (const breakMinutes of breakCandidates(preferredMinutes)) {
    const breakEnd = addMinutes(actualEnd, breakMinutes);
    if (nextFixedStart && breakEnd.getTime() > nextFixedStart.getTime()) continue;

    const trialOptions: OptimizationOptions = {
      ...options,
      currentTime: breakEnd,
      previousSchedule: currentSchedule,
      lockedSchedule,
    };

    const candidates: Array<{ result: ScheduleResult; preservesNext: boolean }> = [];

    // The first transition after an early finish is minute-accurate rather than
    // forced back onto the normal 30-minute planning grid.
    if (nextOriginalPlacement) {
      const nextTask = tasks.find((task) => task.id === nextOriginalPlacement.taskId);
      if (nextTask) {
        const exactResume = buildExactResumePlacement(
          nextTask,
          tasks,
          breakEnd,
          [...lockedSchedule, ...fixedPlacements],
          trialOptions,
        );

        if (
          exactResume &&
          exactResume.start.getTime() < nextOriginalPlacement.start.getTime()
        ) {
          const advanced = optimizeSchedule(tasks, {
            ...trialOptions,
            lockedSchedule: [...lockedSchedule, exactResume],
          });
          if (advanced.status === "feasible") {
            candidates.push({ result: advanced, preservesNext: true });
          }
        }
      }
    }

    const general = optimizeSchedule(tasks, trialOptions);
    if (general.status === "feasible") {
      candidates.push({ result: general, preservesNext: false });
    }

    for (const candidateEntry of candidates) {
      const candidate = candidateEntry.result;
      if (candidate.status !== "feasible") continue;
      const compactedSchedule = compactScheduleForward(
        candidate.schedule,
        tasks,
        trialOptions,
      );
      const issues = validateSchedule(compactedSchedule, tasks, {
        ...trialOptions,
        requireMandatoryPlacement: true,
      });
      if (issues.length > 0) continue;

      const compacted: ScheduleResult = {
        ...candidate,
        schedule: compactedSchedule,
        score: scoreSchedule(compactedSchedule, tasks, trialOptions),
      };
      const idle = activeIdleMinutesAfter(
        compactedSchedule,
        tasks,
        breakEnd,
      );
      const score = compacted.status === "feasible" ? compacted.score.total : Infinity;

      if (
        !best ||
        (candidateEntry.preservesNext && !best.preservesNext) ||
        (candidateEntry.preservesNext === best.preservesNext &&
          idle < best.activeIdleMinutes - 0.001) ||
        (candidateEntry.preservesNext === best.preservesNext &&
          Math.abs(idle - best.activeIdleMinutes) < 0.001 &&
          Math.abs(preferredMinutes - breakMinutes) <
            Math.abs(preferredMinutes - best.breakMinutes)) ||
        (candidateEntry.preservesNext === best.preservesNext &&
          Math.abs(idle - best.activeIdleMinutes) < 0.001 &&
          Math.abs(preferredMinutes - breakMinutes) ===
            Math.abs(preferredMinutes - best.breakMinutes) &&
          score < best.score - 0.001)
      ) {
        best = {
          result: compacted,
          breakMinutes,
          activeIdleMinutes: idle,
          score,
          preservesNext: candidateEntry.preservesNext,
        };
      }
    }
  }

  if (best) {
    return withPostTaskBreak(
      best.result,
      preferredMinutes,
      best.breakMinutes,
      actualEnd,
    );
  }

  return optimizeSchedule(tasks, {
    ...options,
    lockedSchedule,
    previousSchedule: currentSchedule,
  });
}

function activeIdleMinutesAfter(
  schedule: ScheduledTask[],
  tasks: Task[],
  from: Date,
): number {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const future = schedule
    .map((placement) => occupiedInterval(placement, taskMap.get(placement.taskId)))
    .filter((interval) => interval.end.getTime() > from.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let cursor = new Date(from.getTime());
  let idle = 0;
  for (const interval of future) {
    if (interval.start.getTime() > cursor.getTime()) {
      idle += minutesBetween(cursor, interval.start);
    }
    if (interval.end.getTime() > cursor.getTime()) {
      cursor = new Date(interval.end.getTime());
    }
  }
  return idle;
}

function buildExactResumePlacement(
  task: Task,
  tasks: Task[],
  resumeTime: Date,
  protectedSchedule: ScheduledTask[],
  options: OptimizationOptions,
): ScheduledTask | null {
  const earliestAfterTravel = addMinutes(resumeTime, travelMinutesForTask(task));
  const start =
    task.earliestStart && task.earliestStart.getTime() > earliestAfterTravel.getTime()
      ? new Date(task.earliestStart.getTime())
      : earliestAfterTravel;
  const placement: ScheduledTask = {
    taskId: task.id,
    start,
    end: addMinutes(start, task.durationMinutes),
  };

  const issues = validateSchedule(
    [...protectedSchedule, placement],
    tasks,
    { ...options, requireMandatoryPlacement: false },
  );

  return issues.length === 0 ? placement : null;
}

function withPostTaskBreak(
  result: ScheduleResult,
  preferredMinutes: PostTaskBreakMinutes,
  minutes: number,
  start: Date,
): ScheduleResult {
  if (result.status !== "feasible" || minutes <= 0) return result;

  const postTaskBreak: PostTaskBreak = {
    preferredMinutes,
    minutes,
    start: new Date(start.getTime()),
    end: addMinutes(start, minutes),
  };

  return { ...result, postTaskBreak };
}

function breakCandidates(preferred: PostTaskBreakMinutes): number[] {
  if (preferred === 0) return [0];

  const options: number[] = [];
  for (let minutes = preferred; minutes >= 5; minutes -= 1) {
    options.push(minutes);
  }
  options.push(0);
  return options;
}
