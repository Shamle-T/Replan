import { describe, expect, it } from "vitest";
import { validateSchedule } from "../scheduler";
import { at, options, task } from "./helpers";

describe("hard constraints", () => {
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

  it("detects a strict deadline violation", () => {
    const tasks = [task({ id: "a", title: "A", deadline: at(10) })];
    const issues = validateSchedule(
      [{ taskId: "a", start: at(9, 30), end: at(10, 30) }],
      tasks,
      options,
    );
    expect(issues.some((issue) => issue.code === "MISSED_DEADLINE")).toBe(true);
  });

  it("detects an availability-window violation", () => {
    const tasks = [task({ id: "a", title: "A", earliestStart: at(11), latestEnd: at(13) })];
    const issues = validateSchedule(
      [{ taskId: "a", start: at(10), end: at(11) }],
      tasks,
      options,
    );
    expect(issues.some((issue) => issue.code === "BEFORE_EARLIEST_START")).toBe(true);
  });
});
