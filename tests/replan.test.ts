import { describe, expect, it } from "vitest";
import { replanSchedule } from "../scheduler";
import { at, task } from "./helpers";

describe("adaptive replanning", () => {
  it("moves flexible work without moving a fixed commitment after an overrun", () => {
    const tasks = [task({ id: "current", title: "Current", status: "in-progress" }), task({ id: "next", title: "Next", priority: 5 }), task({ id: "fixed", title: "Fixed", fixedStart: at(13), fixedEnd: at(14) })];
    const result = replanSchedule(tasks, [{ taskId: "current", start: at(10), end: at(11) }, { taskId: "next", start: at(11), end: at(12) }, { taskId: "fixed", start: at(13), end: at(14) }], { type: "TASK_OVERRUN", taskId: "current", newExpectedEnd: at(11, 30) }, { currentTime: at(10, 30), dayStart: at(8), dayEnd: at(20), slotMinutes: 30 });
    expect(result.status).toBe("feasible");
    expect(result.schedule.find((item) => item.taskId === "fixed")?.start.getTime()).toBe(at(13).getTime());
  });

  it("releases early-finish time while respecting a requested pause", () => {
    const tasks = [task({ id: "current", title: "Current", status: "in-progress" }), task({ id: "next", title: "Next", priority: 5 })];
    const result = replanSchedule(tasks, [{ taskId: "current", start: at(10), end: at(11) }, { taskId: "next", start: at(11), end: at(12) }], { type: "TASK_COMPLETED", taskId: "current", actualEnd: at(10, 30) }, { currentTime: at(10, 30), dayStart: at(8), dayEnd: at(20), slotMinutes: 30, postTaskBreakMinutes: 10 });
    expect(result.status).toBe("feasible");
    expect(result.postTaskBreak?.minutes).toBe(10);
  });
});
