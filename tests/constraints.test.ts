import { describe, expect, it } from "vitest";

import { validateSchedule } from "../scheduler";
import { at, options, task } from "./helpers";

describe("hard scheduling constraints", () => {
  it("detects overlapping fixed commitments", () => {
    const tasks = [
      task({ id: "a", title: "A", fixedStart: at(9), fixedEnd: at(10) }),
      task({ id: "b", title: "B", fixedStart: at(9, 30), fixedEnd: at(10, 30) }),
    ];

    const issues = validateSchedule(
      [
        { taskId: "a", start: at(9), end: at(10) },
        { taskId: "b", start: at(9, 30), end: at(10, 30) },
      ],
      tasks,
      options,
    );

    expect(issues.some((issue) => issue.code === "OVERLAP")).toBe(true);
  });

  it("detects strict deadline and availability violations", () => {
    const tasks = [
      task({ id: "deadline", title: "Deadline", deadline: at(10) }),
      task({ id: "window", title: "Window", earliestStart: at(11), latestEnd: at(13) }),
    ];

    const issues = validateSchedule(
      [
        { taskId: "deadline", start: at(9, 30), end: at(10, 30) },
        { taskId: "window", start: at(10), end: at(11) },
      ],
      tasks,
      options,
    );

    expect(issues.map((issue) => issue.code)).toContain("MISSED_DEADLINE");
    expect(issues.map((issue) => issue.code)).toContain("BEFORE_EARLIEST_START");
  });

  it("rejects a moved fixed task and a placement outside the planning day", () => {
    const tasks = [
      task({ id: "fixed", title: "Fixed", fixedStart: at(11), fixedEnd: at(12) }),
      task({ id: "early", title: "Early" }),
    ];

    const issues = validateSchedule(
      [
        { taskId: "fixed", start: at(11, 30), end: at(12, 30) },
        { taskId: "early", start: at(7, 30), end: at(8, 30) },
      ],
      tasks,
      options,
    );

    expect(issues.map((issue) => issue.code)).toContain("FIXED_TIME_MISMATCH");
    expect(issues.map((issue) => issue.code)).toContain("OUTSIDE_DAY");
  });

  it("can validate partial schedules while the optimizer is still placing tasks", () => {
    const tasks = [task({ id: "unscheduled", title: "Unscheduled" })];

    const issues = validateSchedule([], tasks, {
      ...options,
      requireMandatoryPlacement: false,
    });

    expect(issues).toEqual([]);
  });
});
