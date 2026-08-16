import { describe, expect, it } from "vitest";
import { createDemoState } from "../lib/demo";
import { optimizeSchedule, validateSchedule } from "../scheduler";

describe("demo schedule", () => {
  it("optimizes to a legal deterministic day", () => { const demo = createDemoState(new Date(2026, 7, 15)); const result = optimizeSchedule(demo.tasks, { currentTime: demo.currentTime, dayStart: demo.dayStart, dayEnd: demo.dayEnd, slotMinutes: 30 }); expect(result.status).toBe("feasible"); expect(validateSchedule(result.schedule, demo.tasks, { currentTime: demo.currentTime, dayStart: demo.dayStart, dayEnd: demo.dayEnd, slotMinutes: 30 }).length).toBe(0); });
});
