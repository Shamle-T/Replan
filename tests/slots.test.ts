import { describe, expect, it } from "vitest";
import { snapUpToGrid } from "../scheduler";
import { at } from "./helpers";

describe("time grid", () => {
  it("snaps arbitrary current time to the next 30-minute boundary", () => {
    expect(snapUpToGrid(at(13, 27), 30, at(8)).getTime()).toBe(at(13, 30).getTime());
  });

  it("keeps an already aligned time unchanged", () => {
    expect(snapUpToGrid(at(13, 30), 30, at(8)).getTime()).toBe(at(13, 30).getTime());
  });
});
