import { describe, expect, it } from "vitest";

import {
  DEFAULT_SLOT_MINUTES,
  snapToNextSlotBoundary,
  validateSchedule
} from "../src/scheduler/index.js";
import type { ScheduledTask, SchedulerOptions, Task } from "../src/scheduler/index.js";

function at(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 7, 13, hour, minute, 0, 0));
}

function createOptions(overrides: Partial<SchedulerOptions> = {}): SchedulerOptions {
  return {
    currentTime: at(8, 0),
    dayStart: at(8, 0),
    dayEnd: at(18, 0),
    slotMinutes: DEFAULT_SLOT_MINUTES,
    ...overrides
  };
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Task 1",
    durationMinutes: 60,
    priority: 3,
    optional: false,
    status: "planned",
    ...overrides
  };
}

function createScheduledTask(
  taskId: string,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number
): ScheduledTask {
  return {
    taskId,
    start: at(startHour, startMinute),
    end: at(endHour, endMinute)
  };
}

describe("validateSchedule", () => {
  it("accepts a valid simple schedule", () => {
    const tasks = [
      createTask({ id: "task-1", durationMinutes: 60 }),
      createTask({ id: "task-2", durationMinutes: 30, title: "Task 2" })
    ];
    const schedule = [
      createScheduledTask("task-1", 9, 0, 10, 0),
      createScheduledTask("task-2", 10, 0, 10, 30)
    ];

    const result = validateSchedule(schedule, tasks, createOptions());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("detects overlapping scheduled tasks", () => {
    const tasks = [
      createTask({ id: "task-1", durationMinutes: 60 }),
      createTask({ id: "task-2", durationMinutes: 60, title: "Task 2" })
    ];
    const schedule = [
      createScheduledTask("task-1", 9, 0, 10, 0),
      createScheduledTask("task-2", 9, 30, 10, 30)
    ];

    const result = validateSchedule(schedule, tasks, createOptions());

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("OVERLAPPING_SCHEDULED_TASKS");
  });

  it("detects a fixed event moved from its exact interval", () => {
    const task = createTask({
      id: "fixed-1",
      fixedStart: at(11, 0),
      fixedEnd: at(12, 0)
    });
    const schedule = [createScheduledTask("fixed-1", 11, 30, 12, 30)];

    const result = validateSchedule(schedule, [task], createOptions());

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("FIXED_TASK_INTERVAL_MISMATCH");
  });

  it("detects deadline violations", () => {
    const task = createTask({
      id: "deadline-1",
      deadline: at(12, 0)
    });
    const schedule = [createScheduledTask("deadline-1", 11, 30, 12, 30)];

    const result = validateSchedule(schedule, [task], createOptions());

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("DEADLINE_VIOLATION");
  });

  it("detects earliest-start violations", () => {
    const task = createTask({
      id: "window-1",
      earliestStart: at(10, 0)
    });
    const schedule = [createScheduledTask("window-1", 9, 0, 10, 0)];

    const result = validateSchedule(schedule, [task], createOptions());

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("EARLIEST_START_VIOLATION");
  });

  it("detects latest-finish violations", () => {
    const task = createTask({
      id: "window-2",
      latestEnd: at(11, 0)
    });
    const schedule = [createScheduledTask("window-2", 10, 30, 11, 30)];

    const result = validateSchedule(schedule, [task], createOptions());

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("LATEST_END_VIOLATION");
  });

  it("detects tasks scheduled outside the configured day", () => {
    const task = createTask({ id: "day-1" });
    const schedule = [createScheduledTask("day-1", 7, 30, 8, 30)];

    const result = validateSchedule(schedule, [task], createOptions());

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("OUTSIDE_DAY_BOUNDS");
  });

  it("detects duration mismatch and invalid task duration", () => {
    const tasks = [
      createTask({ id: "bad-duration", durationMinutes: 0 }),
      createTask({ id: "mismatch", durationMinutes: 45 })
    ];
    const schedule = [
      createScheduledTask("bad-duration", 9, 0, 9, 0),
      createScheduledTask("mismatch", 10, 0, 11, 0)
    ];

    const result = validateSchedule(schedule, tasks, createOptions());

    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("INVALID_TASK_DURATION");
    expect(result.errors.map((error) => error.code)).toContain("SCHEDULED_DURATION_MISMATCH");
  });

  it("allows a task with no scheduled placement", () => {
    const task = createTask({ id: "unscheduled-1" });

    const result = validateSchedule([], [task], createOptions());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("uses the supplied currentTime for future scheduling rules deterministically", () => {
    const task = createTask({
      id: "completed-1",
      status: "completed"
    });
    const schedule = [createScheduledTask("completed-1", 9, 0, 10, 0)];
    const options = createOptions({ currentTime: at(8, 30) });

    const first = validateSchedule(schedule, [task], options);
    const second = validateSchedule(schedule, [task], options);
    const afterCompletion = validateSchedule(
      schedule,
      [task],
      createOptions({ currentTime: at(10, 0) })
    );

    expect(first).toEqual(second);
    expect(first.errors.map((error) => error.code)).toContain("NON_SCHEDULABLE_TASK_STATUS");
    expect(afterCompletion.errors.map((error) => error.code)).not.toContain(
      "NON_SCHEDULABLE_TASK_STATUS"
    );
  });
});

describe("snapToNextSlotBoundary", () => {
  it("keeps exact slot boundaries unchanged", () => {
    expect(snapToNextSlotBoundary(at(13, 30))).toEqual(at(13, 30));
  });

  it("snaps times between boundaries upward", () => {
    expect(snapToNextSlotBoundary(at(13, 27))).toEqual(at(13, 30));
    expect(snapToNextSlotBoundary(at(13, 31))).toEqual(at(14, 0));
  });
});
