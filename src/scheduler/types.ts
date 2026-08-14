export type TaskPriority = 1 | 2 | 3 | 4 | 5;

export type TaskStatus =
  | "planned"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "skipped";

export interface Task {
  id: string;
  title: string;
  durationMinutes: number;
  priority: TaskPriority;
  deadline?: Date;
  fixedStart?: Date;
  fixedEnd?: Date;
  earliestStart?: Date;
  latestEnd?: Date;
  optional: boolean;
  status: TaskStatus;
}

export interface ScheduledTask {
  taskId: string;
  start: Date;
  end: Date;
}

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

export interface SchedulerOptions {
  currentTime: Date;
  dayStart: Date;
  dayEnd: Date;
  slotMinutes: number;
}

export type ValidationErrorCode =
  | "INVALID_TASK_DURATION"
  | "MALFORMED_FIXED_INTERVAL"
  | "UNKNOWN_TASK_REFERENCE"
  | "SCHEDULED_DURATION_MISMATCH"
  | "OVERLAPPING_SCHEDULED_TASKS"
  | "FIXED_TASK_INTERVAL_MISMATCH"
  | "DEADLINE_VIOLATION"
  | "EARLIEST_START_VIOLATION"
  | "LATEST_END_VIOLATION"
  | "OUTSIDE_DAY_BOUNDS"
  | "NON_SCHEDULABLE_TASK_STATUS";

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  taskId?: string;
  relatedTaskIds?: string[];
}

export interface ScheduleResult {
  ok: boolean;
  schedule: ScheduledTask[];
  errors: ValidationError[];
}

export interface ScheduleValidationResult {
  ok: boolean;
  errors: ValidationError[];
}
