export type TaskPriority = 1 | 2 | 3 | 4 | 5;

export type TaskStatus =
  | "planned"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "skipped";

export type TaskCategory =
  | "academic"
  | "fitness"
  | "development"
  | "social"
  | "other";

export interface Task {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
  priority: TaskPriority;
  category?: TaskCategory;

  deadline?: Date;

  fixedStart?: Date;
  fixedEnd?: Date;

  earliestStart?: Date;
  latestEnd?: Date;

  /** Optional buffer reserved immediately before the task for getting there. */
  travelMinutesBefore?: number;
  /** Optional buffer reserved immediately after the task for getting away / returning. */
  travelMinutesAfter?: number;
  /** User-requested pause after this task before another task may begin. Defaults to 0. */
  bufferMinutesAfter?: number;
  /** Human-readable venue/place for the task and travel context. */
  location?: string;
  /** Optional city/suburb/postcode used for weather lookup when the venue is not geocodable. */
  weatherLocation?: string;
  /** When true, the UI weather adapter supplies clear/dry time windows to the scheduler. */
  weatherSensitive?: boolean;
  /** Explicit user override: keep/schedule the outdoor task even when forecast rules reject the time. */
  weatherOverride?: boolean;

  optional: boolean;
  status: TaskStatus;
}

export interface ScheduledTask {
  taskId: string;
  start: Date;
  end: Date;
}

export interface SchedulingWindow {
  start: Date;
  end: Date;
}

export type WeatherWindowsByTaskId = Record<string, SchedulingWindow[]>;

export type ScheduleChange =
  | {
      type: "TASK_COMPLETED";
      taskId: string;
      actualEnd: Date;
    }
  | {
      type: "TASK_OVERRUN";
      taskId: string;
      newExpectedEnd: Date;
    }
  | {
      type: "TASK_CANCELLED";
      taskId: string;
    }
  | {
      type: "TASK_SKIPPED";
      taskId: string;
    };

export type SchedulingRequest =
  | {
      type: "FIND_TIME";
      taskId: string;
    }
  | {
      type: "OPTIMIZE_DAY";
    };

export interface SchedulingOptions {
  currentTime: Date;
  dayStart: Date;
  dayEnd: Date;
  slotMinutes: number;
  /**
   * A missing key means weather has not been requested for the task.
   * An empty array means weather was checked and there is no suitable slot today.
   */
  weatherWindowsByTaskId?: WeatherWindowsByTaskId;
}

/** A zero-minute immediate start, or a user-selected 5-60 minute break. */
export type PostTaskBreakMinutes = number;

export interface OptimizationOptions extends SchedulingOptions {
  previousSchedule?: ScheduledTask[];
  lockedSchedule?: ScheduledTask[];
  maxSearchNodes?: number;
  postTaskBreakMinutes?: PostTaskBreakMinutes;
}

export interface PostTaskBreak {
  preferredMinutes: PostTaskBreakMinutes;
  minutes: number;
  start: Date;
  end: Date;
}

export type ValidationIssueCode =
  | "UNKNOWN_TASK"
  | "DUPLICATE_PLACEMENT"
  | "INVALID_DURATION"
  | "PLACEMENT_DURATION_MISMATCH"
  | "OVERLAP"
  | "TRAVEL_OVERLAP"
  | "FIXED_TIME_MISMATCH"
  | "MISSING_FIXED_BOUND"
  | "OUTSIDE_DAY"
  | "BEFORE_EARLIEST_START"
  | "AFTER_LATEST_END"
  | "MISSED_DEADLINE"
  | "WEATHER_UNSUITABLE"
  | "MANDATORY_UNSCHEDULED";

export interface ValidationIssue {
  code: ValidationIssueCode;
  message: string;
  taskIds: string[];
}

export interface ScoreBreakdown {
  priorityDelay: number;
  deadlinePressure: number;
  idleGaps: number;
  optionalUnscheduled: number;
  disruption: number;
  total: number;
}

export type ReasonCode =
  | "FIXED_COMMITMENT"
  | "HIGH_PRIORITY_EARLY"
  | "BEFORE_DEADLINE"
  | "WITHIN_AVAILABILITY"
  | "LOW_DISRUPTION"
  | "OPTIONAL_OMITTED"
  | "WEATHER_HELD"
  | "SEARCH_LIMIT_REACHED"
  | "NO_LEGAL_PLACEMENT"
  | "REPLAN_COMPLETED_EARLY"
  | "REPLAN_COMPLETED"
  | "POST_TASK_BREAK"
  | "REPLAN_OVERRUN"
  | "REPLAN_CANCELLED"
  | "REPLAN_SKIPPED"
  | "SCHEDULE_MOVED"
  | "SCHEDULE_REMOVED"
  | "SCHEDULE_ADDED";

export interface ScheduleReason {
  code: ReasonCode;
  summary: string;
  taskId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export type ScheduleDiffType =
  | "added"
  | "removed"
  | "moved"
  | "resized"
  | "unchanged";

export interface ScheduleDiffEntry {
  taskId: string;
  type: ScheduleDiffType;
  before?: ScheduledTask;
  after?: ScheduledTask;
  deltaMinutes?: number;
}

export interface FeasibleScheduleResult {
  status: "feasible";
  schedule: ScheduledTask[];
  score: ScoreBreakdown;
  reasons: ScheduleReason[];
  unscheduledTaskIds: string[];
  searchNodes: number;
  searchTruncated: boolean;
  diff?: ScheduleDiffEntry[];
  postTaskBreak?: PostTaskBreak;
}

export interface InfeasibleScheduleResult {
  status: "infeasible";
  schedule: ScheduledTask[];
  issues: ValidationIssue[];
  reasons: ScheduleReason[];
  unscheduledTaskIds: string[];
  searchNodes: number;
  searchTruncated: boolean;
  diff?: ScheduleDiffEntry[];
  postTaskBreak?: PostTaskBreak;
}

export type ScheduleResult = FeasibleScheduleResult | InfeasibleScheduleResult;

export interface PreferredTimeResult {
  status: "feasible" | "infeasible";
  placement?: ScheduledTask;
  result: ScheduleResult;
}
