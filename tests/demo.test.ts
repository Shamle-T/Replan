import { describe, expect, it } from "vitest";
import { createDemoState } from "../lib/demo";

describe("default plan seed", () => {
  it("creates the configured plan for the requested date", () => {
    const baseDate = new Date(2030, 4, 12, 16, 45);
    const state = createDemoState(baseDate);

    expect(state.tasks).toHaveLength(7);
    expect(state.tasks.find((task) => task.id === "lecture")?.fixedStart).toEqual(
      new Date(2030, 4, 12, 9),
    );
    expect(state.schedule.find((item) => item.taskId === "gym")?.start).toEqual(
      new Date(2030, 4, 12, 18, 30),
    );
    expect(state.dayStart).toEqual(new Date(2030, 4, 12, 6));
    expect(state.dayEnd).toEqual(new Date(2030, 4, 13, 0));
    expect(state.simulationTime).toEqual(new Date(2030, 4, 12, 8, 30));
  });

  it("keeps the seed deterministic regardless of the base time", () => {
    const first = createDemoState(new Date(2030, 4, 12, 1));
    const second = createDemoState(new Date(2031, 8, 20, 23));

    expect(first.tasks.map((task) => task.id)).toEqual(second.tasks.map((task) => task.id));
    expect(first.schedule.map((item) => item.taskId)).toEqual(
      second.schedule.map((item) => item.taskId),
    );
  });
});
