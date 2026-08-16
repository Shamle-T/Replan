import { describe, expect, it } from "vitest";
import { createDemoState } from "../lib/demo";
import { diffSchedules, optimizeSchedule, scoreSchedule, validateSchedule } from "../scheduler";

const baseDate = new Date(2026, 7, 15, 8, 0, 0, 0);

describe("demo optimization flow", () => {
  it("starts valid but deliberately unoptimized, then improves only when optimization is requested", () => {
    const demo = createDemoState(baseDate);
    const options = {
      currentTime: demo.dayStart,
      dayStart: demo.dayStart,
      dayEnd: demo.dayEnd,
      slotMinutes: 30,
    };

    expect(
      validateSchedule(demo.schedule, demo.tasks, {
        ...options,
        requireMandatoryPlacement: false,
      }),
    ).toEqual([]);

    const before = scoreSchedule(demo.schedule, demo.tasks, options).total;
    const optimized = optimizeSchedule(demo.tasks, options);

    expect(optimized.status).toBe("feasible");
    if (optimized.status !== "feasible") return;

    const after = scoreSchedule(optimized.schedule, demo.tasks, options).total;
    const changed = diffSchedules(demo.schedule, optimized.schedule).filter(
      (entry) => entry.type !== "unchanged",
    );

    expect(changed.length).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
    expect(optimized.schedule.find((item) => item.taskId === "assignment")?.start.getHours()).toBe(10);
    expect(optimized.schedule.find((item) => item.taskId === "paper")?.start.getHours()).toBe(15);
    expect(optimized.schedule.find((item) => item.taskId === "gym")?.start.getHours()).toBe(17);
  });
});
