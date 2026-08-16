import type { PostTaskBreakMinutes, ScheduledTask, Task } from "../scheduler/types";

const STORAGE_KEY = "replan:mvp:v3-final";
const BREAK_PREFERENCE_KEY = "replan:post-task-break:v1";

interface PersistedTask extends Omit<
  Task,
  "deadline" | "fixedStart" | "fixedEnd" | "earliestStart" | "latestEnd"
> {
  deadline?: string;
  fixedStart?: string;
  fixedEnd?: string;
  earliestStart?: string;
  latestEnd?: string;
}

interface PersistedScheduleItem {
  taskId: string;
  start: string;
  end: string;
}

export interface PersistedReplanState {
  tasks: Task[];
  schedule: ScheduledTask[];
}

export function saveReplanState(state: PersistedReplanState): void {
  if (typeof window === "undefined") return;
  const payload = {
    tasks: state.tasks.map(serializeTask),
    schedule: state.schedule.map((item) => ({
      taskId: item.taskId,
      start: item.start.toISOString(),
      end: item.end.toISOString(),
    })),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadReplanState(): PersistedReplanState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      tasks: PersistedTask[];
      schedule: PersistedScheduleItem[];
    };
    return {
      tasks: parsed.tasks.map(deserializeTask),
      schedule: parsed.schedule.map((item) => ({
        taskId: item.taskId,
        start: new Date(item.start),
        end: new Date(item.end),
      })),
    };
  } catch {
    return null;
  }
}

export function clearReplanState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function saveBreakPreference(minutes: PostTaskBreakMinutes): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BREAK_PREFERENCE_KEY, String(minutes));
}

export function loadBreakPreference(): PostTaskBreakMinutes {
  if (typeof window === "undefined") return 10;
  const value = Number(window.localStorage.getItem(BREAK_PREFERENCE_KEY));
  return Number.isInteger(value) && value >= 5 && value <= 15 ? (value as PostTaskBreakMinutes) : 10;
}

function serializeTask(task: Task): PersistedTask {
  return {
    ...task,
    deadline: task.deadline?.toISOString(),
    fixedStart: task.fixedStart?.toISOString(),
    fixedEnd: task.fixedEnd?.toISOString(),
    earliestStart: task.earliestStart?.toISOString(),
    latestEnd: task.latestEnd?.toISOString(),
  };
}

function deserializeTask(task: PersistedTask): Task {
  return {
    ...task,
    // Older demo builds did not always persist status consistently. Treat a
    // missing/unknown status as planned so a visible calendar placement can
    // never disappear from Live Day's current/next activity cards.
    status: isKnownTaskStatus(task.status) ? task.status : "planned",
    deadline: task.deadline ? new Date(task.deadline) : undefined,
    fixedStart: task.fixedStart ? new Date(task.fixedStart) : undefined,
    fixedEnd: task.fixedEnd ? new Date(task.fixedEnd) : undefined,
    earliestStart: task.earliestStart ? new Date(task.earliestStart) : undefined,
    latestEnd: task.latestEnd ? new Date(task.latestEnd) : undefined,
  };
}

function isKnownTaskStatus(value: unknown): value is Task["status"] {
  return (
    value === "planned" ||
    value === "in-progress" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "skipped"
  );
}
