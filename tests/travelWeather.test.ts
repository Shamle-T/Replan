import { describe, expect, it } from "vitest";
import { optimizeSchedule, validateSchedule } from "../scheduler";
import { at, options, task } from "./helpers";

describe("travel and weather-aware scheduling", () => {
  it("protects travel time before a fixed commitment", () => {
    const tasks = [
      task({ id: "study", title: "Study for A1", durationMinutes: 60 }),
      task({
        id: "lecture",
        title: "Algorithms lecture",
        fixedStart: at(10),
        fixedEnd: at(11),
        travelMinutesBefore: 15,
      }),
    ];

    const issues = validateSchedule(
      [
        { taskId: "study", start: at(9), end: at(10) },
        { taskId: "lecture", start: at(10), end: at(11) },
      ],
      tasks,
      options,
    );

    expect(issues.some((issue) => issue.code === "TRAVEL_OVERLAP")).toBe(true);
  });

  it("moves flexible work early enough to preserve travel", () => {
    const tasks = [
      task({ id: "study", title: "Study", durationMinutes: 60, priority: 5 }),
      task({
        id: "lecture",
        title: "Lecture",
        fixedStart: at(10),
        fixedEnd: at(11),
        travelMinutesBefore: 15,
      }),
    ];

    const result = optimizeSchedule(tasks, options);
    expect(result.status).toBe("feasible");
    expect(result.schedule.find((item) => item.taskId === "study")!.end.getTime()).toBeLessThanOrEqual(
      at(9, 45).getTime(),
    );
  });

  it("only places an outdoor task inside injected clear-weather windows", () => {
    const outdoor = task({
      id: "run",
      title: "Run",
      durationMinutes: 60,
      weatherSensitive: true,
    });
    const result = optimizeSchedule([outdoor], {
      ...options,
      weatherWindowsByTaskId: {
        run: [{ start: at(16), end: at(18) }],
      },
    });

    expect(result.status).toBe("feasible");
    const placement = result.schedule.find((item) => item.taskId === "run");
    expect(placement).toBeDefined();
    expect(placement!.start.getTime()).toBeGreaterThanOrEqual(at(16).getTime());
    expect(placement!.end.getTime()).toBeLessThanOrEqual(at(18).getTime());
  });


  it("allows an explicit user weather override to bypass forecast windows", () => {
    const outdoor = task({
      id: "run-anyway",
      title: "Run anyway",
      durationMinutes: 60,
      weatherSensitive: true,
      weatherOverride: true,
      optional: false,
    });
    const result = optimizeSchedule([outdoor], {
      ...options,
      weatherWindowsByTaskId: { "run-anyway": [] },
    });

    expect(result.status).toBe("feasible");
    expect(result.schedule.some((item) => item.taskId === "run-anyway")).toBe(true);
  });

  it("keeps an outdoor task open when no suitable weather exists", () => {
    const outdoor = task({
      id: "run",
      title: "Run",
      durationMinutes: 60,
      weatherSensitive: true,
      optional: false,
    });
    const result = optimizeSchedule([outdoor], {
      ...options,
      weatherWindowsByTaskId: { run: [] },
    });

    expect(result.status).toBe("feasible");
    expect(result.schedule.some((item) => item.taskId === "run")).toBe(false);
    expect(result.unscheduledTaskIds).toContain("run");
  });
});

describe("travel after event", () => {
  it("reserves manual return/onward travel after the task", () => {
    const first = task({
      id: "event",
      title: "Event",
      durationMinutes: 60,
      priority: 3,
      travelMinutesAfter: 30,
    });
    const second = task({ id: "next", title: "Next", durationMinutes: 60, priority: 3 });
    const schedule = [
      { taskId: first.id, start: at(13), end: at(14) },
      { taskId: second.id, start: at(14), end: at(15) },
    ];
    const issues = validateSchedule(schedule, [first, second], {
      currentTime: at(6),
      dayStart: at(6),
      dayEnd: at(24),
      slotMinutes: 30,
      requireMandatoryPlacement: false,
    });
    expect(issues.some((issue) => issue.code === "TRAVEL_OVERLAP")).toBe(true);
  });
});
