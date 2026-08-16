/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const scheduler = require("../.core-build/scheduler/index.js");
const simulation = require("../.core-build/lib/simulation.js");

const at = (hour, minute = 0) => new Date(2026, 7, 15, hour, minute, 0, 0);
const task = (overrides) => ({
  durationMinutes: 60,
  priority: 3,
  optional: false,
  status: "planned",
  ...overrides,
});
const options = { currentTime: at(8), dayStart: at(8), dayEnd: at(20) };

const gapSchedule = [
  { taskId: "gap-a", start: at(12), end: at(13) },
  { taskId: "gap-b", start: at(14), end: at(15) },
  { taskId: "gap-c", start: at(17), end: at(18) },
];
const gaps = scheduler.findInternalScheduleGaps(gapSchedule);
assert.equal(gaps.length, 2);
assert.equal(gaps[0].minutes, 60);
assert.equal(scheduler.totalInternalGapMinutes(gapSchedule), 180);

const simple = scheduler.optimizeSchedule([
  task({ id: "fixed", title: "Lecture", fixedStart: at(9), fixedEnd: at(10) }),
  task({ id: "high", title: "High", priority: 5 }),
  task({ id: "low", title: "Low", priority: 1 }),
], options);
assert.equal(simple.status, "feasible");
assert.equal(simple.schedule.length, 3);
assert.ok(simple.schedule.find(x => x.taskId === "high").start < simple.schedule.find(x => x.taskId === "low").start);

const impossible = scheduler.optimizeSchedule([
  task({ id: "a", title: "A", durationMinutes: 150 }),
  task({ id: "b", title: "B", durationMinutes: 150 }),
], { ...options, dayEnd: at(12) });
assert.equal(impossible.status, "infeasible");

const preferred = scheduler.findPreferredTime(
  "read",
  [
    task({ id: "fixed", title: "Lecture", fixedStart: at(9), fixedEnd: at(10) }),
    task({ id: "read", title: "Read", priority: 5, deadline: at(13) }),
  ],
  [{ taskId: "fixed", start: at(9), end: at(10) }],
  options,
);
assert.equal(preferred.status, "feasible");
assert.ok(preferred.placement.end <= at(13));

const replanned = scheduler.replanSchedule(
  [
    task({ id: "current", title: "Current", status: "in-progress" }),
    task({ id: "next", title: "Next", priority: 5 }),
    task({ id: "fixed", title: "Meeting", fixedStart: at(13), fixedEnd: at(14) }),
  ],
  [
    { taskId: "current", start: at(10), end: at(11) },
    { taskId: "next", start: at(11), end: at(12) },
    { taskId: "fixed", start: at(13), end: at(14) },
  ],
  { type: "TASK_OVERRUN", taskId: "current", newExpectedEnd: at(11, 30) },
  { ...options, currentTime: at(10, 30) },
);
assert.equal(replanned.status, "feasible");
assert.equal(replanned.schedule.find(x => x.taskId === "fixed").start.getTime(), at(13).getTime());
assert.ok(replanned.schedule.find(x => x.taskId === "next").start >= at(11, 30));


const early = scheduler.replanSchedule(
  [
    task({ id: "early-current", title: "Early current", status: "in-progress" }),
    task({ id: "early-next", title: "Early next", priority: 2 }),
  ],
  [
    { taskId: "early-current", start: at(10), end: at(11) },
    { taskId: "early-next", start: at(11), end: at(12) },
  ],
  { type: "TASK_COMPLETED", taskId: "early-current", actualEnd: at(10, 30) },
  { ...options, currentTime: at(10, 30), postTaskBreakMinutes: 10 },
);
assert.equal(early.status, "feasible");
assert.equal(early.postTaskBreak.minutes, 10);
assert.equal(early.schedule.find(x => x.taskId === "early-next").start.getTime(), at(10, 40).getTime());

const fixedEarly = scheduler.replanSchedule(
  [
    task({ id: "demo-lecture", title: "Lecture", status: "in-progress", fixedStart: at(9), fixedEnd: at(10) }),
    task({ id: "demo-next", title: "Assignment", durationMinutes: 90, priority: 5, earliestStart: at(9), deadline: at(18) }),
  ],
  [
    { taskId: "demo-lecture", start: at(9), end: at(10) },
    { taskId: "demo-next", start: at(10), end: at(11, 30) },
  ],
  { type: "TASK_COMPLETED", taskId: "demo-lecture", actualEnd: at(9, 30) },
  { ...options, currentTime: at(9, 30), dayEnd: at(22), postTaskBreakMinutes: 10 },
);
assert.equal(fixedEarly.status, "feasible");
assert.equal(fixedEarly.postTaskBreak.minutes, 10);
assert.equal(fixedEarly.schedule.find(x => x.taskId === "demo-next").start.getTime(), at(9, 40).getTime());

const customRelax = scheduler.replanSchedule(
  [
    task({ id: "custom-current", title: "Current", status: "in-progress", fixedStart: at(9), fixedEnd: at(10) }),
    task({ id: "custom-next", title: "Next", durationMinutes: 60, priority: 5, earliestStart: at(9), deadline: at(18) }),
  ],
  [
    { taskId: "custom-current", start: at(9), end: at(10) },
    { taskId: "custom-next", start: at(10), end: at(11) },
  ],
  { type: "TASK_COMPLETED", taskId: "custom-current", actualEnd: at(9, 30) },
  { ...options, currentTime: at(9, 30), dayEnd: at(22), postTaskBreakMinutes: 7 },
);
assert.equal(customRelax.status, "feasible");
assert.equal(customRelax.postTaskBreak.minutes, 7);
assert.equal(customRelax.schedule.find(x => x.taskId === "custom-next").start.getTime(), at(9, 37).getTime());

const startImmediately = scheduler.replanSchedule(
  [
    task({ id: "now-current", title: "Current", status: "in-progress", fixedStart: at(9), fixedEnd: at(10) }),
    task({ id: "now-next", title: "Next", durationMinutes: 60, priority: 5, earliestStart: at(9), deadline: at(18) }),
  ],
  [
    { taskId: "now-current", start: at(9), end: at(10) },
    { taskId: "now-next", start: at(10), end: at(11) },
  ],
  { type: "TASK_COMPLETED", taskId: "now-current", actualEnd: at(9, 30) },
  { ...options, currentTime: at(9, 30), dayEnd: at(22), postTaskBreakMinutes: 0 },
);
assert.equal(startImmediately.status, "feasible");
assert.equal(startImmediately.postTaskBreak, undefined);
assert.equal(startImmediately.schedule.find(x => x.taskId === "now-next").start.getTime(), at(9, 30).getTime());


const travelTasks = [
  task({ id: "travel-study", title: "Study", durationMinutes: 60 }),
  task({ id: "travel-lecture", title: "Lecture", fixedStart: at(10), fixedEnd: at(11), travelMinutesBefore: 15 }),
];
const travelIssues = scheduler.validateSchedule(
  [
    { taskId: "travel-study", start: at(9), end: at(10) },
    { taskId: "travel-lecture", start: at(10), end: at(11) },
  ],
  travelTasks,
  options,
);
assert.ok(travelIssues.some(issue => issue.code === "TRAVEL_OVERLAP"));

const returnTravelTasks = [
  task({ id: "event-return", title: "Event", durationMinutes: 60, travelMinutesAfter: 30 }),
  task({ id: "next-return", title: "Next", durationMinutes: 60 }),
];
const returnTravelIssues = scheduler.validateSchedule(
  [
    { taskId: "event-return", start: at(13), end: at(14) },
    { taskId: "next-return", start: at(14), end: at(15) },
  ],
  returnTravelTasks,
  options,
);
assert.ok(returnTravelIssues.some(issue => issue.code === "TRAVEL_OVERLAP"));

const weatherPlan = scheduler.optimizeSchedule(
  [task({ id: "run", title: "Run", weatherSensitive: true })],
  { ...options, weatherWindowsByTaskId: { run: [{ start: at(16), end: at(18) }] } },
);
assert.equal(weatherPlan.status, "feasible");
assert.ok(weatherPlan.schedule.find(x => x.taskId === "run").start >= at(16));

const weatherBlocked = scheduler.optimizeSchedule(
  [task({ id: "rain-run", title: "Rain run", weatherSensitive: true })],
  { ...options, weatherWindowsByTaskId: { "rain-run": [] } },
);
assert.equal(weatherBlocked.status, "feasible");
assert.equal(weatherBlocked.schedule.some(x => x.taskId === "rain-run"), false);
assert.ok(weatherBlocked.unscheduledTaskIds.includes("rain-run"));

const deterministicA = scheduler.optimizeSchedule([
  task({ id: "a", title: "A", priority: 4 }),
  task({ id: "b", title: "B", priority: 2 }),
], options);
const deterministicB = scheduler.optimizeSchedule([
  task({ id: "a", title: "A", priority: 4 }),
  task({ id: "b", title: "B", priority: 2 }),
], options);
assert.deepEqual(deterministicA.schedule, deterministicB.schedule);

assert.equal(simulation.advanceSimulatedTime(at(8), 1000, 1).getTime(), at(8, 1).getTime());
assert.equal(simulation.advanceSimulatedTime(at(8), 1000, 5).getTime(), at(8, 5).getTime());



const correctedExtension = scheduler.replanSchedule(
  [task({ id: "extended", title: "Extended", durationMinutes: 75, status: "in-progress" })],
  [{ taskId: "extended", start: at(10), end: at(11, 15) }],
  { type: "TASK_OVERRUN", taskId: "extended", newExpectedEnd: at(11) },
  { ...options, currentTime: at(10, 30) },
);
assert.equal(correctedExtension.status, "feasible");
assert.equal(correctedExtension.schedule.find(x => x.taskId === "extended").end.getTime(), at(11).getTime());

const compactPlan = scheduler.optimizeSchedule([
  task({ id: "compact-a", title: "Compact A", durationMinutes: 45, priority: 5 }),
  task({ id: "compact-b", title: "Compact B", durationMinutes: 60, priority: 3 }),
], options);
assert.equal(compactPlan.status, "feasible");
const compactA = compactPlan.schedule.find(x => x.taskId === "compact-a");
const compactB = compactPlan.schedule.find(x => x.taskId === "compact-b");
assert.equal(compactB.start.getTime(), compactA.end.getTime());

const bufferedPlan = scheduler.optimizeSchedule([
  task({ id: "buffer-a", title: "Buffer A", durationMinutes: 45, priority: 5, bufferMinutesAfter: 10 }),
  task({ id: "buffer-b", title: "Buffer B", durationMinutes: 60, priority: 3 }),
], options);
assert.equal(bufferedPlan.status, "feasible");
const bufferA = bufferedPlan.schedule.find(x => x.taskId === "buffer-a");
const bufferB = bufferedPlan.schedule.find(x => x.taskId === "buffer-b");
assert.equal((bufferB.start.getTime() - bufferA.end.getTime()) / 60000, 10);


// Live release at an arbitrary minute must compact the whole remaining chain,
// not only the first task or a fixed time boundary.
const nonGridSkip = scheduler.replanSchedule(
  [
    task({ id: "ng-current", title: "Current", status: "in-progress" }),
    task({ id: "ng-a", title: "A", priority: 5 }),
    task({ id: "ng-b", title: "B", priority: 3 }),
    task({ id: "ng-c", title: "C", priority: 1 }),
  ],
  [
    { taskId: "ng-current", start: at(10), end: at(11) },
    { taskId: "ng-a", start: at(11), end: at(12) },
    { taskId: "ng-b", start: at(12), end: at(13) },
    { taskId: "ng-c", start: at(13), end: at(14) },
  ],
  { type: "TASK_SKIPPED", taskId: "ng-current" },
  { ...options, currentTime: at(10, 37) },
);
assert.equal(nonGridSkip.status, "feasible");
assert.equal(nonGridSkip.schedule.find(x => x.taskId === "ng-a").start.getTime(), at(10, 37).getTime());
assert.equal(nonGridSkip.schedule.find(x => x.taskId === "ng-b").start.getTime(), at(11, 37).getTime());
assert.equal(nonGridSkip.schedule.find(x => x.taskId === "ng-c").start.getTime(), at(12, 37).getTime());

// If the preferred relax window would make a flexible task miss a narrow slot
// before a fixed commitment, reduce the break rather than leaving a large hole.
const narrowSlotEarly = scheduler.replanSchedule(
  [
    task({ id: "slot-current", title: "Current", status: "in-progress" }),
    task({ id: "slot-short", title: "Short", durationMinutes: 25, priority: 5 }),
    task({ id: "slot-fixed", title: "Fixed", fixedStart: at(11), fixedEnd: at(12) }),
    task({ id: "slot-later", title: "Later", durationMinutes: 60, priority: 3 }),
  ],
  [
    { taskId: "slot-current", start: at(10), end: at(11) },
    { taskId: "slot-fixed", start: at(11), end: at(12) },
    { taskId: "slot-short", start: at(12), end: at(12, 25) },
    { taskId: "slot-later", start: at(12, 30), end: at(13, 30) },
  ],
  { type: "TASK_COMPLETED", taskId: "slot-current", actualEnd: at(10, 30) },
  { ...options, currentTime: at(10, 30), postTaskBreakMinutes: 10 },
);
assert.equal(narrowSlotEarly.status, "feasible");
assert.equal(narrowSlotEarly.postTaskBreak.minutes, 5);
assert.equal(narrowSlotEarly.schedule.find(x => x.taskId === "slot-short").start.getTime(), at(10, 35).getTime());
assert.equal(narrowSlotEarly.schedule.find(x => x.taskId === "slot-short").end.getTime(), at(11).getTime());
assert.equal(narrowSlotEarly.schedule.find(x => x.taskId === "slot-later").start.getTime(), at(12).getTime());

// Multiple downstream tasks must move together after an overrun, and a later
// early finish of that same extended task must reclaim the time again.
const cascadeTasks = [
  task({ id: "cascade-current", title: "Current", status: "in-progress", priority: 5 }),
  task({ id: "cascade-a", title: "A", priority: 5 }),
  task({ id: "cascade-b", title: "B", priority: 3 }),
  task({ id: "cascade-c", title: "C", priority: 1 }),
  task({ id: "cascade-fixed", title: "Fixed", fixedStart: at(15), fixedEnd: at(16) }),
];
const cascadeSchedule = [
  { taskId: "cascade-current", start: at(10), end: at(11) },
  { taskId: "cascade-a", start: at(11), end: at(12) },
  { taskId: "cascade-b", start: at(12), end: at(13) },
  { taskId: "cascade-c", start: at(13), end: at(14) },
  { taskId: "cascade-fixed", start: at(15), end: at(16) },
];
const cascadeOverrun = scheduler.replanSchedule(
  cascadeTasks,
  cascadeSchedule,
  { type: "TASK_OVERRUN", taskId: "cascade-current", newExpectedEnd: at(11, 40) },
  { ...options, currentTime: at(10, 30) },
);
assert.equal(cascadeOverrun.status, "feasible");
assert.equal(cascadeOverrun.schedule.find(x => x.taskId === "cascade-a").start.getTime(), at(11, 40).getTime());
assert.equal(cascadeOverrun.schedule.find(x => x.taskId === "cascade-b").start.getTime(), at(12, 40).getTime());
assert.equal(cascadeOverrun.schedule.find(x => x.taskId === "cascade-c").start.getTime(), at(13, 40).getTime());

const cascadeTasksAfterOverrun = cascadeTasks.map(item =>
  item.id === "cascade-current"
    ? { ...item, durationMinutes: 100, status: "in-progress" }
    : item,
);
const cascadeEarly = scheduler.replanSchedule(
  cascadeTasksAfterOverrun,
  cascadeOverrun.schedule,
  { type: "TASK_COMPLETED", taskId: "cascade-current", actualEnd: at(10, 50) },
  { ...options, currentTime: at(10, 50), postTaskBreakMinutes: 10 },
);
assert.equal(cascadeEarly.status, "feasible");
assert.equal(cascadeEarly.schedule.find(x => x.taskId === "cascade-a").start.getTime(), at(11).getTime());
assert.equal(cascadeEarly.schedule.find(x => x.taskId === "cascade-b").start.getTime(), at(12).getTime());
assert.equal(cascadeEarly.schedule.find(x => x.taskId === "cascade-c").start.getTime(), at(13).getTime());

console.log("Core verification passed: constraints, travel buffers, weather windows, compact scheduling, requested intervals, optimization, visible open-time gaps, preferred time, adaptive replanning with cascading live compaction, post-task relax fallback, determinism, and simulation clock.");
