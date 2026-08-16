/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");

const required = ["scheduler/index.ts", "scheduler/search.ts", "scheduler/replan.ts", "scheduler/occupancy.ts"];
const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) { console.error(`Missing scheduler modules: ${missing.join(", ")}`); process.exit(1); }
console.log("Scheduler module structure is complete.");
