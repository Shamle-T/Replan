import { describe, expect, it } from "vitest";
import { optimizeSchedule, validateSchedule } from "../scheduler";
import { at, options, task } from "./helpers";

describe("travel and weather constraints", () => {
  it("reserves travel before a fixed commitment", () => { const tasks = [task({ id: "study", title: "Study" }), task({ id: "lecture", title: "Lecture", fixedStart: at(10), fixedEnd: at(11), travelMinutesBefore: 15 })]; expect(validateSchedule([{ taskId: "study", start: at(9), end: at(10) }, { taskId: "lecture", start: at(10), end: at(11) }], tasks, options).some((issue) => issue.code === "TRAVEL_OVERLAP")).toBe(true); });
  it("places an outdoor task only inside supplied weather windows", () => { const result = optimizeSchedule([task({ id: "run", title: "Run", weatherSensitive: true })], { ...options, weatherWindowsByTaskId: { run: [{ start: at(16), end: at(18) }] } }); expect(result.status).toBe("feasible"); expect(result.schedule.find((item) => item.taskId === "run")?.start.getTime()).toBeGreaterThanOrEqual(at(16).getTime()); });
});
