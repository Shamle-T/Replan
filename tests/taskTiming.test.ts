import { describe, expect, it } from "vitest";
import { deriveFixedEnd, fixedDurationMinutes } from "../lib/taskTiming";
import { at } from "./helpers";

describe("fixed task timing", () => {
  it("derives duration from existing fixed bounds", () => {
    expect(fixedDurationMinutes(at(9), at(10, 15))).toBe(75);
  });

  it("derives an end time from a fixed start and custom duration", () => {
    expect(deriveFixedEnd(at(0), "14:02", 75)).toEqual(at(15, 17));
  });

  it("rejects missing or invalid fixed timing inputs", () => {
    expect(deriveFixedEnd(at(0), "", 60)).toBeUndefined();
    expect(deriveFixedEnd(at(0), "14:02", 0)).toBeUndefined();
    expect(fixedDurationMinutes(at(10), at(9))).toBe(0);
  });
});
