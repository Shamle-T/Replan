import { describe, expect, it } from "vitest";
import { optimizeSchedule } from "../scheduler";
import { options, task } from "./helpers";

describe("interval packing", () => {
  it("keeps a requested post-task interval free", () => { const first = task({ id: "first", title: "First", bufferMinutesAfter: 15 }); const second = task({ id: "second", title: "Second" }); const result = optimizeSchedule([first, second], options); expect(result.status).toBe("feasible"); const a = result.schedule.find((item) => item.taskId === first.id)!; const b = result.schedule.find((item) => item.taskId === second.id)!; expect(Math.abs(b.start.getTime() - a.end.getTime())).toBeGreaterThanOrEqual(15 * 60_000); });
});
