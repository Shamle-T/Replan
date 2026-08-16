import { describe, expect, it } from "vitest";
import { optimizeSchedule, validateSchedule } from "../scheduler";
import { at, options, task } from "./helpers";

describe("compact scheduling and user-requested intervals", () => {
  it("packs flexible work directly together when no interval is requested", () => {
    const tasks = [
      task({ id: "first", title: "First", durationMinutes: 45, priority: 5 }),
      task({ id: "second", title: "Second", durationMinutes: 60, priority: 3 }),
    ];

    const result = optimizeSchedule(tasks, options);
    expect(result.status).toBe("feasible");
    const first = result.schedule.find((item) => item.taskId === "first")!;
    const second = result.schedule.find((item) => item.taskId === "second")!;

    expect(second.start.getTime()).toBe(first.end.getTime());
  });

  it("keeps an explicitly requested interval after a task", () => {
    const tasks = [
      task({
        id: "first",
        title: "First",
        durationMinutes: 45,
        priority: 5,
        bufferMinutesAfter: 10,
      }),
      task({ id: "second", title: "Second", durationMinutes: 60, priority: 3 }),
    ];

    const result = optimizeSchedule(tasks, options);
    expect(result.status).toBe("feasible");
    const first = result.schedule.find((item) => item.taskId === "first")!;
    const second = result.schedule.find((item) => item.taskId === "second")!;

    expect((second.start.getTime() - first.end.getTime()) / 60_000).toBe(10);
    expect(validateSchedule(result.schedule, tasks, options)).toEqual([]);
  });

  it("packs against a fixed commitment without an artificial grid gap", () => {
    const tasks = [
      task({ id: "work", title: "Work", durationMinutes: 45, priority: 5 }),
      task({ id: "fixed", title: "Fixed", durationMinutes: 60, fixedStart: at(10), fixedEnd: at(11) }),
    ];

    const result = optimizeSchedule(tasks, options);
    expect(result.status).toBe("feasible");
    const work = result.schedule.find((item) => item.taskId === "work")!;
    expect(work.end.getTime()).toBeLessThanOrEqual(at(10).getTime());
  });
});
