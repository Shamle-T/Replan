import { describe, expect, it } from "vitest";
import { parseUpdateMessage } from "../interactions/updateParser";
import { at, task } from "./helpers";

describe("structured live updates", () => {
  const current = task({ id: "a", title: "Assignment" });
  const placement = { taskId: "a", start: at(10), end: at(11) };
  it("maps a completion phrase to a factual completion", () => expect(parseUpdateMessage("finished early", current, placement, at(10, 25))?.type).toBe("TASK_COMPLETED"));
  it("maps a duration request to an overrun", () => { const result = parseUpdateMessage("need 30 min", current, placement, at(10, 25)); expect(result?.type).toBe("TASK_OVERRUN"); if (result?.type === "TASK_OVERRUN") expect(result.newExpectedEnd.getTime()).toBe(at(11, 30).getTime()); });
});
