import { describe, expect, it } from "vitest";
import { advanceSimulatedTime, nextScheduleBoundary } from "../lib/simulation";
import { at } from "./helpers";

describe("simulation clock", () => {
  it("advances the supplied clock deterministically", () => expect(advanceSimulatedTime(at(8), 1_000, 5).getTime()).toBe(at(8, 5).getTime()));
  it("finds the next schedule boundary", () => expect(nextScheduleBoundary(at(8, 10), [{ taskId: "a", start: at(9), end: at(10) }])?.getTime()).toBe(at(9).getTime()));
});
