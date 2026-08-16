import type { Task, TaskCategory } from "../scheduler/types";

export interface TaskCategoryMeta {
  key: TaskCategory;
  label: string;
  shortLabel: string;
}

export const TASK_CATEGORIES: TaskCategoryMeta[] = [
  { key: "academic", label: "Academic", shortLabel: "Academic" },
  { key: "fitness", label: "Fitness & sport", shortLabel: "Fitness" },
  { key: "development", label: "Personal development", shortLabel: "Development" },
  { key: "social", label: "Social & personal", shortLabel: "Social" },
  { key: "other", label: "Other", shortLabel: "Other" },
];

export function categoryForTask(task: Task): TaskCategory {
  return task.category ?? inferCategory(task.title);
}

export function inferCategory(title: string): TaskCategory {
  const value = title.toLowerCase();
  if (/lecture|assignment|revision|study|class|tutorial|lab|exam|paper|research/.test(value)) {
    return "academic";
  }
  if (/gym|run|running|football|sport|workout|swim|training|cycle|cycling/.test(value)) {
    return "fitness";
  }
  if (/read|meditat|journal|learn|course|practice|book/.test(value)) {
    return "development";
  }
  if (/lunch|dinner|breakfast|friend|social|coffee|family|date/.test(value)) {
    return "social";
  }
  return "other";
}

export function categoryLabel(category: TaskCategory): string {
  return TASK_CATEGORIES.find((item) => item.key === category)?.shortLabel ?? "Other";
}
