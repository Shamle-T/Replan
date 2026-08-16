import { describe, expect, it } from "vitest";
import { findPreferredTime } from "../scheduler";
import { at, options, task } from "./helpers";

describe("preferred time", () => {
  it("selects a legal placement for an unscheduled task", () => { const item = task({ id: "a", title: "A", earliestStart: at(10) }); const result = findPreferredTime(item.id, [item], [], options); expect(result.status).toBe("feasible"); expect(result.placement?.start.getTime()).toBeGreaterThanOrEqual(at(10).getTime()); });
});
