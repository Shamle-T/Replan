import { describe, expect, it } from "vitest";
import { optimizeSchedule } from "../scheduler";
import { at, options, task } from "./helpers";

describe("daily optimization", () => {
  it("builds a simple feasible day", () => {
    const tasks = [
      task({ id: "fixed", title: "Lecture", fixedStart: at(9), fixedEnd: at(10) }),
      task({ id: "work", title: "Work", durationMinutes: 90, priority: 5, deadline: at(14) }),
      task({ id: "read", title: "Read", durationMinutes: 60, priority: 2 }),
    ];
    const result = optimizeSchedule(tasks, options);
    expect(result.status).toBe("feasible");
    expect(result.schedule).toHaveLength(3);
  });

  it("reports impossible mandatory workload as infeasible", () => {
    const tinyDay = { ...options, dayEnd: at(12) };
    const tasks = [
      task({ id: "a", title: "A", durationMinutes: 150 }),
      task({ id: "b", title: "B", durationMinutes: 150 }),
    ];
    const result = optimizeSchedule(tasks, tinyDay);
    expect(result.status).toBe("infeasible");
  });

  it("returns identical output for identical inputs and currentTime", () => {
    const tasks = [
      task({ id: "a", title: "A", durationMinutes: 60, priority: 5 }),
      task({ id: "b", title: "B", durationMinutes: 60, priority: 3 }),
    ];
    const first = optimizeSchedule(tasks, options);
    const second = optimizeSchedule(tasks, options);
    expect(first.schedule).toEqual(second.schedule);
    expect(first.status).toBe(second.status);
  });

  it("uses deterministic scoring to put higher-priority work earlier", () => {
    const tasks = [
      task({ id: "low", title: "Low", durationMinutes: 60, priority: 1 }),
      task({ id: "high", title: "High", durationMinutes: 60, priority: 5 }),
    ];
    const result = optimizeSchedule(tasks, options);
    expect(result.status).toBe("feasible");
    const high = result.schedule.find((item) => item.taskId === "high");
    const low = result.schedule.find((item) => item.taskId === "low");
    expect(high!.start.getTime()).toBeLessThan(low!.start.getTime());
  });

  it("treats highest priority as an early preference, not a fixed start", () => {
    const tasks = [
      task({
        id: "must-do-flex",
        title: "Must-do flexible work",
        durationMinutes: 60,
        priority: 5,
        earliestStart: at(10, 30),
      }),
      task({ id: "nice-later", title: "Nice to have", durationMinutes: 60, priority: 1 }),
    ];
    const result = optimizeSchedule(tasks, options);
    expect(result.status).toBe("feasible");
    const mustDo = result.schedule.find((item) => item.taskId === "must-do-flex");
    expect(mustDo).toBeDefined();
    expect(mustDo!.start.getTime()).toBe(at(10, 30).getTime());
    expect(tasks[0].fixedStart).toBeUndefined();
  });

});
