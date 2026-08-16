/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");

const required = ["components/LiveDayView.tsx", "components/NowCard.tsx", "lib/liveActivity.ts", "interactions/updateParser.ts"];
const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) { console.error(`Missing live-day files: ${missing.join(", ")}`); process.exit(1); }
console.log("Live-day integration files are present.");
