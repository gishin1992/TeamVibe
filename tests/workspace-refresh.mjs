import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  createRefreshGate,
  mergeWorkspaceSnapshot,
  commitWorkspaceProject,
} from "../lib/teamvibe/workspace-refresh.ts";
const first = {
  user: { id: "a", name: "A" },
  users: [{ id: "a", name: "A" }],
  projects: [
    { id: "p", version: 1, name: "Old" },
    { id: "removed", version: 8 },
  ],
};
const gate = createRefreshGate();
const slow = gate.begin();
let release;
const delayed = new Promise((resolve) => {
  release = resolve;
});
let snapshot = first;
const receive = delayed.then((incoming) => {
  if (gate.accepts(slow)) snapshot = mergeWorkspaceSnapshot(snapshot, incoming);
});
const finish = gate.beginWrite();
assert(!gate.canRead());
assert(!gate.accepts(slow));
const during = gate.begin();
finish();
finish(); // A duplicate finally must not change the write count.
assert(gate.canRead());
assert(!gate.accepts(during));
snapshot = commitWorkspaceProject(
  snapshot,
  { id: "p", version: 2, name: "Saved" },
  "a",
);
release(first);
await receive;
assert.equal(snapshot.projects[0].name, "Saved");
assert.equal(snapshot.projects[0].version, 2);
const older = gate.begin(),
  newer = gate.begin();
assert(gate.accepts(newer));
assert(!gate.accepts(older));
gate.invalidate();
assert(!gate.accepts(newer));
const endA = gate.beginWrite(),
  endB = gate.beginWrite();
endA();
assert(!gate.canRead());
endB();
assert(gate.canRead());
assert(
  gate.accepts(gate.begin()),
  "Refresh remains usable after success/failure write cleanup",
);
const stableBefore = structuredClone(snapshot);
const merged = mergeWorkspaceSnapshot(snapshot, {
  ...first,
  projects: [
    { id: "p", version: 1, name: "Stale" },
    { id: "new", version: 1 },
  ],
});
assert.deepEqual(
  merged.projects.map((p) => p.id),
  ["p", "new"],
);
assert.equal(
  merged.projects[0].version,
  2,
  "Local committed version never moves backwards",
);
assert.deepEqual(snapshot, stableBefore);
const peer = mergeWorkspaceSnapshot(merged, {
  ...first,
  projects: [{ id: "p", version: 3, name: "Peer" }],
});
assert.equal(peer.projects[0].name, "Peer");
assert.deepEqual(
  commitWorkspaceProject(
    peer,
    { id: "p", version: 2, name: "Late write" },
    "a",
  ),
  peer,
);
assert.deepEqual(
  commitWorkspaceProject(peer, { id: "removed", version: 10 }, "a"),
  peer,
  "Do not resurrect a project absent from latest membership",
);
assert.equal(
  commitWorkspaceProject(peer, { id: "p", version: 4 }, "b"),
  peer,
  "Old actor cannot update a different rendered identity",
);
assert.equal(commitWorkspaceProject(null, { id: "p", version: 4 }, "a"), null);
const switched = {
  user: { id: "b", name: "B" },
  users: [],
  projects: [{ id: "p", version: 1, name: "B view" }],
};
assert.equal(mergeWorkspaceSnapshot(peer, switched), switched);
const loggedOut = { user: null, users: first.users, projects: [] };
assert.equal(mergeWorkspaceSnapshot(peer, loggedOut), loggedOut);
assert.equal(mergeWorkspaceSnapshot(null, first), first);
writeFileSync(
  "evidence/workspace-refresh-unit-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      checks: [
        "deferred older read cannot replace a completed local write",
        "out-of-order read and lifecycle generation rejection",
        "overlapping write cleanup remains balanced",
        "same-user project versions monotonic",
        "latest membership authoritative; removed projects never reinserted",
        "identity changes reset merge scope",
        "late or old-actor mutation response cannot replace newer rendered state",
        "input snapshots unchanged",
      ],
      note: "Controlled Node state helper checks. Actual delayed browser responses are recorded separately.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS workspace refresh: delayed/out-of-order reads, write barriers, version monotonicity, membership and identity boundaries.",
);
