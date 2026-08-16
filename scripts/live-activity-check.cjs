const assert = require("node:assert/strict");
const path = require("node:path");
const { rmSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, ".live-activity-build");
rmSync(outDir, { recursive: true, force: true });

const tsc = process.platform === "win32" ? "tsc.cmd" : "tsc";
const compile = spawnSync(tsc, [
  "--target", "ES2022",
  "--module", "commonjs",
  "--moduleResolution", "node",
  "--strict",
  "--esModuleInterop",
  "--skipLibCheck",
  "--outDir", outDir,
  "lib/liveActivity.ts",
  "scheduler/types.ts",
], { cwd: root, stdio: "inherit" });
if (compile.status !== 0) process.exit(compile.status ?? 1);

const { findCurrentPlacement, findNextPlacement, isTaskLiveEligible } = require(path.join(outDir, "lib", "liveActivity.js"));
const at = (h, m=0) => new Date(2026, 7, 15, h, m, 0, 0);
const tasks = [
  { id: "lecture", title: "Algorithms lecture", durationMinutes: 60, priority: 5, optional: false, status: "planned" },
  { id: "gym", title: "Gym", durationMinutes: 60, priority: 1, optional: true, status: "planned" },
];
const taskMap = new Map(tasks.map(t => [t.id, t]));
const schedule = [
  { taskId: "lecture", start: at(9), end: at(10) },
  { taskId: "gym", start: at(10), end: at(11) },
];

assert.equal(findCurrentPlacement(schedule, taskMap, at(9, 0))?.taskId, "lecture", "event must become current exactly at its start");
assert.equal(findCurrentPlacement(schedule, taskMap, at(9, 35))?.taskId, "lecture", "event must remain current while paused/playing inside its interval");
assert.equal(findCurrentPlacement(schedule, taskMap, at(10, 0))?.taskId, "gym", "boundary must hand over to the next event");
assert.equal(findNextPlacement(schedule, taskMap, at(9, 35))?.taskId, "gym", "next event should remain visible while current event runs");
assert.equal(isTaskLiveEligible({ ...tasks[0], status: undefined }), true, "legacy missing status should behave as planned");
assert.equal(isTaskLiveEligible({ ...tasks[0], status: "completed" }), false, "completed work must not become current again");

rmSync(outDir, { recursive: true, force: true });
console.log("Live activity verification passed: scheduled events resolve correctly at start, during playback/pause, and at boundaries.");
