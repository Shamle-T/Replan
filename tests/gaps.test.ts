import { describe, expect, it } from "vitest";
import { findInternalScheduleGaps, totalInternalGapMinutes } from "../scheduler";
import { at } from "./helpers";

describe("internal schedule gaps", () => {
  it("reports visible open time between scheduled tasks", () => {
    const schedule = [
      { taskId: "a", start: at(12), end: at(13) },
      { taskId: "b", start: at(14), end: at(15) },
      { taskId: "c", start: at(17), end: at(18) },
    ];

    const gaps = findInternalScheduleGaps(schedule);

    expect(gaps).toHaveLength(2);
    expect(gaps[0].start.getTime()).toBe(at(13).getTime());
    expect(gaps[0].end.getTime()).toBe(at(14).getTime());
    expect(gaps[0].minutes).toBe(60);
    expect(totalInternalGapMinutes(schedule)).toBe(180);
  });

  it("does not treat day boundaries as internal gaps", () => {
    const schedule = [
      { taskId: "a", start: at(10), end: at(11) },
      { taskId: "b", start: at(11), end: at(12) },
    ];

    expect(findInternalScheduleGaps(schedule)).toEqual([]);
    expect(totalInternalGapMinutes(schedule)).toBe(0);
  });
});
