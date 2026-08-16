export const DEFAULT_SLOT_MINUTES = 30;
export const DEFAULT_MAX_SEARCH_NODES = 120_000;

export const SCORE_WEIGHTS = {
  priorityDelayPerHour: 3,
  deadlinePressure: 18,
  // Replan is intentionally compact-by-default: avoid idle holes unless a
  // hard constraint or an explicit task buffer requires them.
  idleGapPerHour: 24,
  optionalUnscheduled: 90,
  mandatoryWeatherUnscheduled: 1_000,
  disruptionPerHalfHour: 7,
} as const;
