import { describe, expect, it } from "vitest";
import { advanceSimulatedTime, nextScheduleBoundary } from "../lib/simulation";
import { at } from "./helpers";

describe("simulation clock", () => {
  it("changes only the supplied currentTime according to speed", () => {
    expect(advanceSimulatedTime(at(8), 1_000, 5).getTime()).toBe(at(8, 5).getTime());
  });

  it("jumps to the next schedule boundary", () => {
    const next = nextScheduleBoundary(at(8, 10), [
      { taskId: "a", start: at(9), end: at(10) },
    ]);
    expect(next!.getTime()).toBe(at(9).getTime());
  });
});
