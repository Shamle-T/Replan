import { describe, expect, it } from "vitest";
import { validateSchedule } from "../scheduler";
import { at, options, task } from "./helpers";

describe("schedule validation", () => {
  it("rejects overlapping task intervals", () => { const tasks = [task({ id: "a", title: "A" }), task({ id: "b", title: "B" })]; const issues = validateSchedule([{ taskId: "a", start: at(9), end: at(10) }, { taskId: "b", start: at(9, 30), end: at(10, 30) }], tasks, options); expect(issues.some((issue) => issue.code === "OVERLAP")).toBe(true); });
});
