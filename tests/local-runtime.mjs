import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { localStatePath, localRuntimeArgs } from "../scripts/local-state.mjs";

const root = process.cwd();
assert.equal(
  localStatePath(),
  path.resolve(root, process.env.TEAMVIBE_STATE_PATH || ".wrangler/state"),
);
assert.equal(
  localStatePath(".wrangler/state"),
  path.join(root, ".wrangler/state"),
);
assert.equal(
  localStatePath(".sites-runtime/isolated data"),
  path.join(root, ".sites-runtime/isolated data"),
);
assert.throws(() => localStatePath(" "), /non-empty/);
const isolated = localStatePath(".sites-runtime/isolated data");
for (const command of ["db:init", "start"]) {
  const args = localRuntimeArgs(command, [], isolated);
  assert.ok(args.includes("--local"));
  assert.equal(args[args.indexOf("--persist-to") + 1], isolated);
  assert.ok(!args.includes("--remote"));
  assert.throws(() => localRuntimeArgs(command, ["--remote"], isolated));
  assert.throws(() =>
    localRuntimeArgs(command, ["--persist-to", "/tmp/wrong-data"], isolated),
  );
}
assert.equal(
  localRuntimeArgs("start", ["--port", "5178"]).includes("5178"),
  true,
);
assert.equal(localRuntimeArgs("start", ["--port=5178"]).includes("5178"), true);
for (const port of ["0", "65536", "abc", "5178;echo", "1.5"])
  assert.throws(() => localRuntimeArgs("start", ["--port", port]));
const rejected = spawnSync(
  process.execPath,
  ["scripts/local-runtime.mjs", "start", "--remote"],
  { encoding: "utf8" },
);
assert.equal(rejected.status, 1);
assert.match(rejected.stderr, /local resources only/);
assert.ok(!rejected.stdout.includes("Starting local server"));
console.log(
  "PASS local runtime: shared state paths, path spaces, local-only startup, port validation and rejected overrides before server launch.",
);
