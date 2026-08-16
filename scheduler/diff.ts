import { minutesBetween } from "./slots";
import type { ScheduledTask, ScheduleDiffEntry } from "./types";

export function diffSchedules(
  before: ScheduledTask[],
  after: ScheduledTask[],
): ScheduleDiffEntry[] {
  const beforeMap = new Map(before.map((item) => [item.taskId, item]));
  const afterMap = new Map(after.map((item) => [item.taskId, item]));
  const ids = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort();

  return ids.map((taskId) => {
    const prior = beforeMap.get(taskId);
    const next = afterMap.get(taskId);

    if (!prior && next) {
      return { taskId, type: "added", after: next };
    }
    if (prior && !next) {
      return { taskId, type: "removed", before: prior };
    }
    if (!prior || !next) {
      return { taskId, type: "unchanged" };
    }

    const startChanged = prior.start.getTime() !== next.start.getTime();
    const endChanged = prior.end.getTime() !== next.end.getTime();

    if (startChanged) {
      return {
        taskId,
        type: "moved",
        before: prior,
        after: next,
        deltaMinutes: Math.round(minutesBetween(prior.start, next.start)),
      };
    }
    if (endChanged) {
      return {
        taskId,
        type: "resized",
        before: prior,
        after: next,
        deltaMinutes: Math.round(minutesBetween(prior.end, next.end)),
      };
    }
    return { taskId, type: "unchanged", before: prior, after: next };
  });
}