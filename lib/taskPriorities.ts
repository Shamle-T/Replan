import type { TaskPriority } from "../scheduler/types";

export type PriorityChoice = 1 | 3 | 5;

export const PRIORITY_CHOICES: Array<{
  value: PriorityChoice;
  label: string;
  shortLabel: string;
  help: string;
}> = [
  {
    value: 1,
    label: "Nice to have",
    shortLabel: "Nice to have",
    help: "Scheduled after higher-priority work where possible. It is still flexible unless you set a fixed time.",
  },
  {
    value: 3,
    label: "Important",
    shortLabel: "Important",
    help: "Balanced ahead of nice-to-have work, while still respecting deadlines, windows and fixed commitments.",
  },
  {
    value: 5,
    label: "Must do",
    shortLabel: "Must do",
    help: "Strongly preferred as early as legally possible. It does not become a fixed event unless you explicitly set a fixed time.",
  },
];

export function normalizePriority(priority: TaskPriority): PriorityChoice {
  if (priority >= 4) return 5;
  if (priority <= 2) return 1;
  return 3;
}

export function priorityLabel(priority: TaskPriority): string {
  const normalized = normalizePriority(priority);
  return PRIORITY_CHOICES.find((item) => item.value === normalized)?.shortLabel ?? "Important";
}
