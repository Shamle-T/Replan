import { describe, expect, it } from "vitest";

import { intervalsOverlap, snapUpToGrid } from "../scheduler";
import { at } from "./helpers";

describe("scheduling time grid", () => {
  it("snaps arbitrary time to the next 30-minute boundary", () => {
    expect(snapUpToGrid(at(13, 27), 30, at(8)).getTime()).toBe(at(13, 30).getTime());
  });

  it("keeps aligned times unchanged and adjacent intervals separate", () => {
    expect(snapUpToGrid(at(13, 30), 30, at(8)).getTime()).toBe(at(13, 30).getTime());
    expect(intervalsOverlap(at(9), at(10), at(10), at(11))).toBe(false);
  });
});
