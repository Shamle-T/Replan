const { rmSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, ".core-build");
rmSync(outDir, { recursive: true, force: true });

const tsc = process.platform === "win32" ? "tsc.cmd" : "tsc";
const compile = spawnSync(tsc, ["-p", "tsconfig.core.json"], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});
if (compile.status !== 0) process.exit(compile.status ?? 1);

const check = spawnSync(process.execPath, [path.join("scripts", "core-check.cjs")], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});
const status = check.status ?? 1;
rmSync(outDir, { recursive: true, force: true });
process.exit(status);
