import { describe, expect, it } from "vitest";
import { findInternalScheduleGaps, totalInternalGapMinutes } from "../scheduler";
import { at } from "./helpers";

describe("schedule gaps", () => {
  const schedule = [{ taskId: "a", start: at(9), end: at(10) }, { taskId: "b", start: at(10, 30), end: at(11) }];
  it("finds internal free time", () => expect(findInternalScheduleGaps(schedule)[0]?.minutes).toBe(30));
  it("sums internal free time", () => expect(totalInternalGapMinutes(schedule)).toBe(30));
});
