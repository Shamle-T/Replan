import { describe, expect, it } from "vitest";
import { findPreferredTime } from "../scheduler";
import { at, options, task } from "./helpers";

describe("Find a Time", () => {
  it("places an unscheduled flexible task using legal scored placements", () => {
    const tasks = [
      task({ id: "fixed", title: "Lecture", fixedStart: at(9), fixedEnd: at(10) }),
      task({ id: "read", title: "Read", durationMinutes: 60, priority: 4, deadline: at(13) }),
    ];
    const result = findPreferredTime(
      "read",
      tasks,
      [{ taskId: "fixed", start: at(9), end: at(10) }],
      options,
    );
    expect(result.status).toBe("feasible");
    expect(result.placement).toBeDefined();
    expect(result.placement!.end.getTime()).toBeLessThanOrEqual(at(13).getTime());
  });

  it("returns no placement when the allowed window is fully blocked", () => {
    const tasks = [
      task({ id: "fixed", title: "Lecture", durationMinutes: 120, fixedStart: at(10), fixedEnd: at(12) }),
      task({ id: "read", title: "Read", earliestStart: at(10), latestEnd: at(12) }),
    ];
    const result = findPreferredTime(
      "read",
      tasks,
      [{ taskId: "fixed", start: at(10), end: at(12) }],
      options,
    );
    expect(result.status).toBe("infeasible");
  });
});
