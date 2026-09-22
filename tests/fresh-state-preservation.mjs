// Separate cold-start experiment, not part of npm test: requires its explicitly
// prepared isolated state directory and baseline evidence. Never resets data.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const phase = process.argv[2];
assert.ok(["after-reinit", "after-dev", "after-built-restart"].includes(phase));
const fixture = JSON.parse(
  readFileSync("evidence/fresh-start-fixture.json", "utf8"),
);
assert.equal(new URL(fixture.url).hostname, "127.0.0.1");
async function snapshot(base) {
  const login = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "jimin" }),
  });
  assert.equal(login.status, 200);
  const r = await fetch(base + "/api/bootstrap", {
    headers: { cookie: login.headers.get("set-cookie").split(";")[0] },
  });
  assert.equal(r.status, 200);
  return r.json();
}
const actual = await snapshot(fixture.url);
const expected = JSON.parse(
  readFileSync("evidence/fresh-start-persisted-before.json", "utf8"),
);
assert.deepEqual({ users: actual.users, projects: actual.projects }, expected);
const health = await fetch(fixture.url + "/api/health");
assert.equal(health.status, 200);
assert.equal((await health.json()).database, "ready");
const main = await snapshot("http://localhost:5174");
assert.deepEqual(
  main.projects.find((p) => p.id === "d8195b22-80fd-43b6-8fe9-1c4e4c1deb83"),
  JSON.parse(readFileSync("evidence/fresh-start-main-before.json", "utf8")),
);
const evidence = {
  at: new Date().toISOString(),
  phase,
  url: fixture.url,
  users: actual.users.length,
  projects: actual.projects.length,
  fullDataEqual: true,
  originalDemoUnchanged: true,
  note: "Both migrated profile edits and UI-created project are retained. No database files were deleted.",
};
writeFileSync(
  `evidence/fresh-start-${phase}.json`,
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence));
