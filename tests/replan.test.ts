import { describe, expect, it } from "vitest";
import { replanSchedule } from "../scheduler";
import { at, task } from "./helpers";

const liveOptions = {
  currentTime: at(10, 30),
  dayStart: at(8),
  dayEnd: at(20),
};

describe("adaptive replanning", () => {
  it("replans after an overrun without moving a fixed commitment", () => {
    const tasks = [
      task({ id: "current", title: "Current", durationMinutes: 60, status: "in-progress" }),
      task({ id: "next", title: "Next", durationMinutes: 60, priority: 4 }),
      task({ id: "fixed", title: "Meeting", fixedStart: at(13), fixedEnd: at(14) }),
    ];
    const schedule = [
      { taskId: "current", start: at(10), end: at(11) },
      { taskId: "next", start: at(11), end: at(12) },
      { taskId: "fixed", start: at(13), end: at(14) },
    ];
    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_OVERRUN", taskId: "current", newExpectedEnd: at(11, 30) },
      liveOptions,
    );
    expect(result.status).toBe("feasible");
    expect(result.schedule.find((item) => item.taskId === "fixed")!.start.getTime()).toBe(at(13).getTime());
    expect(result.schedule.find((item) => item.taskId === "next")!.start.getTime()).toBeGreaterThanOrEqual(at(11, 30).getTime());
  });

  it("protects a short reset and advances the next task after early completion", () => {
    const tasks = [
      task({ id: "current", title: "Current", durationMinutes: 60, status: "in-progress" }),
      task({ id: "next", title: "Next", durationMinutes: 60, priority: 5 }),
    ];
    const schedule = [
      { taskId: "current", start: at(10), end: at(11) },
      { taskId: "next", start: at(11), end: at(12) },
    ];
    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_COMPLETED", taskId: "current", actualEnd: at(10, 30) },
      { ...liveOptions, postTaskBreakMinutes: 10 },
    );
    expect(result.status).toBe("feasible");
    expect(result.postTaskBreak?.minutes).toBe(10);
    expect(result.schedule.find((item) => item.taskId === "next")!.start.getTime()).toBe(at(10, 40).getTime());
  });

  it("uses released time after an early fixed event instead of leaving avoidable free time", () => {
    const tasks = [
      task({
        id: "lecture",
        title: "Lecture",
        fixedStart: at(9),
        fixedEnd: at(10),
        status: "in-progress",
      }),
      task({
        id: "assignment",
        title: "Assignment",
        durationMinutes: 90,
        priority: 5,
        earliestStart: at(9),
        deadline: at(18),
      }),
    ];
    const schedule = [
      { taskId: "lecture", start: at(9), end: at(10) },
      { taskId: "assignment", start: at(10), end: at(11, 30) },
    ];

    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_COMPLETED", taskId: "lecture", actualEnd: at(9, 30) },
      {
        ...liveOptions,
        currentTime: at(9, 30),
        dayEnd: at(22),
        postTaskBreakMinutes: 10,
      },
    );

    expect(result.status).toBe("feasible");
    expect(result.postTaskBreak?.minutes).toBe(10);
    expect(result.schedule.find((item) => item.taskId === "assignment")!.start.getTime()).toBe(
      at(9, 40).getTime(),
    );
  });

  it("removes a cancelled future task", () => {
    const tasks = [
      task({ id: "a", title: "A", durationMinutes: 60 }),
      task({ id: "b", title: "B", durationMinutes: 60 }),
    ];
    const schedule = [
      { taskId: "a", start: at(11), end: at(12) },
      { taskId: "b", start: at(12), end: at(13) },
    ];
    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_CANCELLED", taskId: "a" },
      liveOptions,
    );
    expect(result.schedule.some((item) => item.taskId === "a")).toBe(false);
  });

  it("keeps the selected relax window before compacting after a cancellation", () => {
    const tasks = [
      task({ id: "cancelled", title: "Cancelled", durationMinutes: 60 }),
      task({ id: "next", title: "Next", durationMinutes: 60 }),
    ];
    const schedule = [
      { taskId: "cancelled", start: at(10), end: at(11) },
      { taskId: "next", start: at(12), end: at(13) },
    ];
    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_CANCELLED", taskId: "cancelled" },
      { ...liveOptions, postTaskBreakMinutes: 30 },
    );

    expect(result.status).toBe("feasible");
    expect(result.postTaskBreak?.minutes).toBe(30);
    expect(result.schedule.find((item) => item.taskId === "next")!.start.getTime()).toBe(
      at(11).getTime(),
    );
  });

  it("never moves past work", () => {
    const tasks = [
      task({ id: "past", title: "Past", durationMinutes: 60 }),
      task({ id: "future", title: "Future", durationMinutes: 60 }),
    ];
    const schedule = [
      { taskId: "past", start: at(8), end: at(9) },
      { taskId: "future", start: at(11), end: at(12) },
    ];
    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_CANCELLED", taskId: "future" },
      liveOptions,
    );
    const past = result.schedule.find((item) => item.taskId === "past");
    expect(past!.start.getTime()).toBe(at(8).getTime());
    expect(past!.end.getTime()).toBe(at(9).getTime());
  });
  it("allows a fixed current commitment to overrun by updating its actual locked end", () => {
    const tasks = [
      task({ id: "lecture", title: "Lecture", fixedStart: at(9), fixedEnd: at(10), status: "in-progress" }),
      task({ id: "work", title: "Work", durationMinutes: 60, priority: 4 }),
    ];
    const schedule = [
      { taskId: "lecture", start: at(9), end: at(10) },
      { taskId: "work", start: at(10), end: at(11) },
    ];
    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_OVERRUN", taskId: "lecture", newExpectedEnd: at(10, 30) },
      { ...liveOptions, currentTime: at(9, 30) },
    );
    expect(result.status).toBe("feasible");
    expect(result.schedule.find((item) => item.taskId === "lecture")!.end.getTime()).toBe(at(10, 30).getTime());
  });

  it("uses the user break preference even for a low-priority next task", () => {
    const tasks = [
      task({ id: "current", title: "Current", durationMinutes: 60, status: "in-progress" }),
      task({ id: "low", title: "Low priority", durationMinutes: 60, priority: 1 }),
    ];
    const schedule = [
      { taskId: "current", start: at(10), end: at(11) },
      { taskId: "low", start: at(11), end: at(12) },
    ];
    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_COMPLETED", taskId: "current", actualEnd: at(10, 20) },
      { ...liveOptions, currentTime: at(10, 20), postTaskBreakMinutes: 15 },
    );
    expect(result.status).toBe("feasible");
    expect(result.postTaskBreak?.minutes).toBe(15);
    expect(result.schedule.find((item) => item.taskId === "low")!.start.getTime()).toBe(at(10, 35).getTime());
  });

  it("shortens the reset when a fixed commitment is too close", () => {
    const tasks = [
      task({ id: "current", title: "Current", durationMinutes: 60, status: "in-progress" }),
      task({ id: "meeting", title: "Meeting", fixedStart: at(11), fixedEnd: at(11, 30) }),
    ];
    const schedule = [
      { taskId: "current", start: at(10), end: at(11) },
      { taskId: "meeting", start: at(11), end: at(11, 30) },
    ];
    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_COMPLETED", taskId: "current", actualEnd: at(10, 55) },
      { ...liveOptions, currentTime: at(10, 55), postTaskBreakMinutes: 15 },
    );
    expect(result.status).toBe("feasible");
    expect(result.postTaskBreak?.minutes).toBe(5);
    expect(result.schedule.find((item) => item.taskId === "meeting")!.start.getTime()).toBe(at(11).getTime());
  });

  it("supports a custom 7-minute relax window", () => {
    const tasks = [
      task({ id: "current-custom", title: "Current", durationMinutes: 60, status: "in-progress" }),
      task({ id: "next-custom", title: "Next", durationMinutes: 60, priority: 5 }),
    ];
    const schedule = [
      { taskId: "current-custom", start: at(10), end: at(11) },
      { taskId: "next-custom", start: at(11), end: at(12) },
    ];
    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_COMPLETED", taskId: "current-custom", actualEnd: at(10, 30) },
      { ...liveOptions, postTaskBreakMinutes: 7 },
    );
    expect(result.status).toBe("feasible");
    expect(result.postTaskBreak?.minutes).toBe(7);
    expect(result.schedule.find((item) => item.taskId === "next-custom")!.start.getTime()).toBe(
      at(10, 37).getTime(),
    );
  });

  it("can start the next task immediately after an early finish", () => {
    const tasks = [
      task({ id: "current-now", title: "Current", durationMinutes: 60, status: "in-progress" }),
      task({ id: "next-now", title: "Next", durationMinutes: 60, priority: 5 }),
    ];
    const schedule = [
      { taskId: "current-now", start: at(10), end: at(11) },
      { taskId: "next-now", start: at(11), end: at(12) },
    ];
    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_COMPLETED", taskId: "current-now", actualEnd: at(10, 30) },
      { ...liveOptions, postTaskBreakMinutes: 0 },
    );
    expect(result.status).toBe("feasible");
    expect(result.postTaskBreak).toBeUndefined();
    expect(result.schedule.find((item) => item.taskId === "next-now")!.start.getTime()).toBe(
      at(10, 30).getTime(),
    );
  });

  it("reports a clear fixed-commitment overlap when current work cannot be extended", () => {
    const tasks = [
      task({ id: "a1", title: "Study for A1", durationMinutes: 60, status: "in-progress" }),
      task({ id: "lecture-fixed", title: "Algorithms lecture", fixedStart: at(10), fixedEnd: at(11) }),
    ];
    const schedule = [
      { taskId: "a1", start: at(9), end: at(10) },
      { taskId: "lecture-fixed", start: at(10), end: at(11) },
    ];
    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_OVERRUN", taskId: "a1", newExpectedEnd: at(10, 15) },
      { ...liveOptions, currentTime: at(9, 30) },
    );
    expect(result.status).toBe("infeasible");
    if (result.status === "infeasible") {
      expect(result.issues.some((issue) => issue.code === "OVERLAP")).toBe(true);
      expect(result.issues[0].taskIds).toContain("lecture-fixed");
    }
  });

  it("accepts an early completion even when the optimizer cannot search for a better arrangement", () => {
    const tasks = [
      task({ id: "done-fallback", title: "Study for A1.1", durationMinutes: 60, status: "in-progress" }),
      task({ id: "fixed-fallback", title: "Lecture", fixedStart: at(11), fixedEnd: at(12) }),
      task({ id: "later-fallback", title: "Revision", durationMinutes: 60, priority: 3 }),
    ];
    const schedule = [
      { taskId: "done-fallback", start: at(10), end: at(11) },
      { taskId: "fixed-fallback", start: at(11), end: at(12) },
      { taskId: "later-fallback", start: at(12), end: at(13) },
    ];

    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_COMPLETED", taskId: "done-fallback", actualEnd: at(10, 30) },
      {
        ...liveOptions,
        currentTime: at(10, 30),
        postTaskBreakMinutes: 10,
        maxSearchNodes: 0,
      },
    );

    expect(result.status).toBe("feasible");
    expect(result.schedule.find((item) => item.taskId === "done-fallback")!.end.getTime()).toBe(
      at(10, 30).getTime(),
    );
    expect(result.schedule.find((item) => item.taskId === "fixed-fallback")!.start.getTime()).toBe(
      at(11).getTime(),
    );
  });


  it("packs future flexible work forward after a skipped task", () => {
    const tasks = [
      task({ id: "skip-current", title: "Algorithms practice", durationMinutes: 60, status: "in-progress" }),
      task({ id: "high-next", title: "Assignment", durationMinutes: 60, priority: 5 }),
      task({ id: "low-next", title: "Reading", durationMinutes: 60, priority: 1 }),
      task({ id: "fixed-later", title: "Project meeting", fixedStart: at(14), fixedEnd: at(15) }),
    ];
    const schedule = [
      { taskId: "skip-current", start: at(10), end: at(11) },
      { taskId: "high-next", start: at(12), end: at(13) },
      { taskId: "low-next", start: at(15), end: at(16) },
      { taskId: "fixed-later", start: at(14), end: at(15) },
    ];

    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_SKIPPED", taskId: "skip-current" },
      { ...liveOptions, currentTime: at(10, 30) },
    );

    expect(result.status).toBe("feasible");
    expect(result.schedule.some((item) => item.taskId === "skip-current")).toBe(false);
    expect(result.schedule.find((item) => item.taskId === "high-next")!.start.getTime()).toBe(
      at(10, 30).getTime(),
    );
    expect(result.schedule.find((item) => item.taskId === "fixed-later")!.start.getTime()).toBe(
      at(14).getTime(),
    );
    expect(result.diff?.some((entry) => entry.taskId === "high-next" && entry.type === "moved")).toBe(true);
  });

  it("uses newly freed time for an unscheduled flexible task after a skip", () => {
    const tasks = [
      task({ id: "skip-slot", title: "Skip me", durationMinutes: 60, status: "in-progress" }),
      task({ id: "unscheduled", title: "Unscheduled important task", durationMinutes: 60, priority: 5 }),
      task({ id: "fixed-block", title: "Fixed meeting", fixedStart: at(12), fixedEnd: at(13) }),
    ];
    const schedule = [
      { taskId: "skip-slot", start: at(10), end: at(11) },
      { taskId: "fixed-block", start: at(12), end: at(13) },
    ];

    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_SKIPPED", taskId: "skip-slot" },
      { ...liveOptions, currentTime: at(10, 30) },
    );

    expect(result.status).toBe("feasible");
    const added = result.schedule.find((item) => item.taskId === "unscheduled");
    expect(added).toBeDefined();
    expect(added!.start.getTime()).toBe(at(10, 30).getTime());
    expect(result.diff?.some((entry) => entry.taskId === "unscheduled" && entry.type === "added")).toBe(true);
  });

  it("allows an overrun when it has room without moving later work", () => {
    const tasks = [
      task({ id: "solo-current", title: "Solo task", durationMinutes: 60, status: "in-progress" }),
    ];
    const schedule = [
      { taskId: "solo-current", start: at(10), end: at(11) },
    ];

    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_OVERRUN", taskId: "solo-current", newExpectedEnd: at(11, 15) },
      { ...liveOptions, currentTime: at(10, 30) },
    );

    expect(result.status).toBe("feasible");
    expect(result.schedule.find((item) => item.taskId === "solo-current")!.end.getTime()).toBe(
      at(11, 15).getTime(),
    );
    expect(result.diff?.filter((entry) => entry.type !== "unchanged").every((entry) => entry.taskId === "solo-current")).toBe(true);
  });


  it("cascades all remaining flexible tasks forward after a non-grid skip", () => {
    const tasks = [
      task({ id: "ng-current", title: "Current", status: "in-progress" }),
      task({ id: "ng-a", title: "A", priority: 5 }),
      task({ id: "ng-b", title: "B", priority: 3 }),
      task({ id: "ng-c", title: "C", priority: 1 }),
    ];
    const schedule = [
      { taskId: "ng-current", start: at(10), end: at(11) },
      { taskId: "ng-a", start: at(11), end: at(12) },
      { taskId: "ng-b", start: at(12), end: at(13) },
      { taskId: "ng-c", start: at(13), end: at(14) },
    ];

    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_SKIPPED", taskId: "ng-current" },
      { ...liveOptions, currentTime: at(10, 37) },
    );

    expect(result.status).toBe("feasible");
    expect(result.schedule.find((item) => item.taskId === "ng-a")!.start.getTime()).toBe(
      at(10, 37).getTime(),
    );
    expect(result.schedule.find((item) => item.taskId === "ng-b")!.start.getTime()).toBe(
      at(11, 37).getTime(),
    );
    expect(result.schedule.find((item) => item.taskId === "ng-c")!.start.getTime()).toBe(
      at(12, 37).getTime(),
    );
  });

  it("shortens the relax window when that is required to use a narrow slot before a fixed event", () => {
    const tasks = [
      task({ id: "slot-current", title: "Current", status: "in-progress" }),
      task({ id: "slot-short", title: "Short", durationMinutes: 25, priority: 5 }),
      task({ id: "slot-fixed", title: "Fixed", fixedStart: at(11), fixedEnd: at(12) }),
      task({ id: "slot-later", title: "Later", durationMinutes: 60, priority: 3 }),
    ];
    const schedule = [
      { taskId: "slot-current", start: at(10), end: at(11) },
      { taskId: "slot-fixed", start: at(11), end: at(12) },
      { taskId: "slot-short", start: at(12), end: at(12, 25) },
      { taskId: "slot-later", start: at(12, 30), end: at(13, 30) },
    ];

    const result = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_COMPLETED", taskId: "slot-current", actualEnd: at(10, 30) },
      { ...liveOptions, currentTime: at(10, 30), postTaskBreakMinutes: 10 },
    );

    expect(result.status).toBe("feasible");
    expect(result.postTaskBreak?.minutes).toBe(5);
    expect(result.schedule.find((item) => item.taskId === "slot-short")!.start.getTime()).toBe(
      at(10, 35).getTime(),
    );
    expect(result.schedule.find((item) => item.taskId === "slot-short")!.end.getTime()).toBe(
      at(11).getTime(),
    );
  });

  it("reclaims the whole downstream chain after an overrun is later finished early", () => {
    const tasks = [
      task({ id: "cascade-current", title: "Current", status: "in-progress", priority: 5 }),
      task({ id: "cascade-a", title: "A", priority: 5 }),
      task({ id: "cascade-b", title: "B", priority: 3 }),
      task({ id: "cascade-c", title: "C", priority: 1 }),
      task({ id: "cascade-fixed", title: "Fixed", fixedStart: at(15), fixedEnd: at(16) }),
    ];
    const schedule = [
      { taskId: "cascade-current", start: at(10), end: at(11) },
      { taskId: "cascade-a", start: at(11), end: at(12) },
      { taskId: "cascade-b", start: at(12), end: at(13) },
      { taskId: "cascade-c", start: at(13), end: at(14) },
      { taskId: "cascade-fixed", start: at(15), end: at(16) },
    ];

    const overrun = replanSchedule(
      tasks,
      schedule,
      { type: "TASK_OVERRUN", taskId: "cascade-current", newExpectedEnd: at(11, 40) },
      { ...liveOptions, currentTime: at(10, 30) },
    );
    expect(overrun.status).toBe("feasible");
    expect(overrun.schedule.find((item) => item.taskId === "cascade-a")!.start.getTime()).toBe(
      at(11, 40).getTime(),
    );
    expect(overrun.schedule.find((item) => item.taskId === "cascade-b")!.start.getTime()).toBe(
      at(12, 40).getTime(),
    );
    expect(overrun.schedule.find((item) => item.taskId === "cascade-c")!.start.getTime()).toBe(
      at(13, 40).getTime(),
    );

    const afterOverrunTasks = tasks.map((item) =>
      item.id === "cascade-current"
        ? { ...item, durationMinutes: 100, status: "in-progress" as const }
        : item,
    );
    const early = replanSchedule(
      afterOverrunTasks,
      overrun.schedule,
      { type: "TASK_COMPLETED", taskId: "cascade-current", actualEnd: at(10, 50) },
      { ...liveOptions, currentTime: at(10, 50), postTaskBreakMinutes: 10 },
    );

    expect(early.status).toBe("feasible");
    expect(early.schedule.find((item) => item.taskId === "cascade-a")!.start.getTime()).toBe(
      at(11).getTime(),
    );
    expect(early.schedule.find((item) => item.taskId === "cascade-b")!.start.getTime()).toBe(
      at(12).getTime(),
    );
    expect(early.schedule.find((item) => item.taskId === "cascade-c")!.start.getTime()).toBe(
      at(13).getTime(),
    );
  });

});
