/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");

const required = ["scheduler/search.ts", "scheduler/replan.ts", "scheduler/constraints.ts", "tests/replan.test.ts"];
const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) { console.error(`Missing core files: ${missing.join(", ")}`); process.exit(1); }
console.log("Core scheduler files and regression coverage are present.");
