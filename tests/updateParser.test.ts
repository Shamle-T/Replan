import { describe, expect, it } from "vitest";
import { parseUpdateMessage } from "../interactions/updateParser";
import { at, task } from "./helpers";

describe("structured update parser", () => {
  it("maps a completion phrase to TASK_COMPLETED", () => {
    const result = parseUpdateMessage("Finished early", {
      currentTime: at(10, 25),
      currentTask: task({ id: "a", title: "A" }),
      currentPlacement: { taskId: "a", start: at(10), end: at(11) },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.change.type).toBe("TASK_COMPLETED");
  });

  it("maps +30 to an overrun", () => {
    const result = parseUpdateMessage("Need +30m", {
      currentTime: at(10, 25),
      currentTask: task({ id: "a", title: "A" }),
      currentPlacement: { taskId: "a", start: at(10), end: at(11) },
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.change.type === "TASK_OVERRUN") {
      expect(result.change.newExpectedEnd.getTime()).toBe(at(11, 30).getTime());
    }
  });
});
