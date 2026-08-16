import { describe, expect, it } from "vitest";

import { optimizeSchedule, scoreSchedule } from "../scheduler";
import { at, options, task } from "./helpers";

describe("deterministic day optimization", () => {
  it("builds a feasible day around a fixed commitment", () => {
    const tasks = [
      task({ id: "fixed", title: "Lecture", fixedStart: at(9), fixedEnd: at(10) }),
      task({ id: "work", title: "Work", durationMinutes: 90, priority: 5, deadline: at(14) }),
      task({ id: "read", title: "Read", durationMinutes: 60, priority: 2 }),
    ];

    const result = optimizeSchedule(tasks, options);

    expect(result.status).toBe("feasible");
    expect(result.schedule).toHaveLength(3);
    expect(result.schedule.find((placement) => placement.taskId === "fixed")).toMatchObject({
      start: at(9),
      end: at(10),
    });
  });

  it("selects the lower-cost ordering for higher-priority work", () => {
    const tasks = [
      task({ id: "low", title: "Low", priority: 1 }),
      task({ id: "high", title: "High", priority: 5 }),
    ];

    const result = optimizeSchedule(tasks, options);

    expect(result.status).toBe("feasible");
    const high = result.schedule.find((placement) => placement.taskId === "high");
    const low = result.schedule.find((placement) => placement.taskId === "low");
    expect(high!.start.getTime()).toBeLessThan(low!.start.getTime());
    expect(scoreSchedule(result.schedule, tasks, options).total).toBe(result.score.total);
  });

  it("reports an infeasible mandatory workload instead of dropping it", () => {
    const result = optimizeSchedule(
      [
        task({ id: "a", title: "A", durationMinutes: 150 }),
        task({ id: "b", title: "B", durationMinutes: 150 }),
      ],
      { ...options, dayEnd: at(12) },
    );

    expect(result.status).toBe("infeasible");
    expect(result.issues.some((issue) => issue.code === "MANDATORY_UNSCHEDULED")).toBe(true);
  });

  it("uses stable output for identical inputs", () => {
    const tasks = [
      task({ id: "a", title: "A", durationMinutes: 60, priority: 5 }),
      task({ id: "b", title: "B", durationMinutes: 60, priority: 3 }),
    ];

    expect(optimizeSchedule(tasks, options)).toEqual(optimizeSchedule(tasks, options));
  });
});
