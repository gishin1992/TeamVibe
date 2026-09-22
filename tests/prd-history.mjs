import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
async function client(userId) {
  const login = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  return async (path, data, expected = 200) => {
    const response = await fetch(base + "/api/" + path, {
      method: data ? "POST" : "GET",
      headers: {
        Cookie: cookie,
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    return result;
  };
}
const a = await client("jimin"),
  b = await client("seoyeon");
let p = await a(
  "projects",
  {
    name: "공동 문서 작성 이력 검사 " + Date.now(),
    description: "합성 API 상태 검사",
    goal: "작성과 보관, 복원 출처를 구분",
  },
  201,
);
p = await b("join", { code: p.inviteCode });
async function op(type, data = {}, who = a, expected = 200) {
  const result = await who(
    "projects/" + p.id,
    { type, version: p.version, ...data },
    expected,
  );
  if (expected === 200) p = result;
  else assert.deepEqual(await a("projects/" + p.id), p);
  return result;
}
await op("requirement.save", {
  title: "합성 취소 범위",
  description: "당일 취소",
  priority: "must",
  status: "accepted",
  decision: "합성 초기 범위",
  sourceIds: [],
});
const firstBody = "# 당일 취소\n신청 당일에 취소한다.";
await op("prd.save", {
  body: firstBody,
  updatedBy: "forged",
  updatedAt: "forged",
  change: "restored",
  restoredFromRevision: 99,
});
assert.equal(p.prd.updatedBy, "jimin");
assert.equal(p.prd.change, "edited");
assert.equal(p.prd.restoredFromRevision, undefined);
assert(p.prd.updatedAt && p.prd.updatedAt !== "forged");
assert.equal(p.prd.history[0].updatedBy, undefined);
const first = structuredClone(p.prd);
await op("prd.save", { body: firstBody }, b);
assert.deepEqual(
  p.prd,
  first,
  "변경 없는 저장은 다른 사람에게 작성자를 넘기지 않는다.",
);
await op("prd.approve");
await op("prd.approve", {}, b);
await op("prd.save", { body: firstBody + "\n취소 사유도 남긴다." }, b);
assert.equal(p.prd.updatedBy, "seoyeon");
assert.equal(p.prd.history.at(-1).updatedBy, "jimin");
assert.equal(p.prd.history.at(-1).updatedAt, first.updatedAt);
assert.equal(p.prd.history.at(-1).authorId, "seoyeon");
assert.equal(p.prd.history.at(-1).body, firstBody);
assert.equal(p.prd.history.at(-1).sourceRevision, first.sourceRevision);
assert.deepEqual(p.prd.approvals, []);
for (const revision of [undefined, null, "1", -1, 1.5, 999, 0])
  await op("prd.restore", { revision }, a, 400);
const oldVersion = p.version;
await op("conversation.save", { title: "별도 대화 변경" });
await a(
  "projects/" + p.id,
  { type: "prd.restore", revision: 1, version: oldVersion },
  409,
);
assert.deepEqual(await a("projects/" + p.id), p);
await op("prd.approve");
await op("prd.approve", {}, b);
const beforeRestore = structuredClone(p.prd);
await op("prd.restore", { revision: 1, body: "forged", updatedBy: "forged" });
assert.equal(p.prd.revision, 3);
assert.equal(p.prd.body, firstBody);
assert.equal(p.prd.updatedBy, "jimin");
assert.equal(p.prd.change, "restored");
assert.equal(p.prd.restoredFromRevision, 1);
assert.deepEqual(p.prd.approvals, []);
assert.deepEqual(p.prd.history.slice(0, -1), beforeRestore.history);
assert.equal(p.prd.history.at(-1).body, beforeRestore.body);
assert.equal(p.prd.history.at(-1).updatedBy, "seoyeon");
assert.equal(p.prd.history.at(-1).authorId, "jimin");
assert.equal(p.events.at(-1).action, "prd.restore");
const restored = structuredClone(p.prd);
await op("prd.save", { body: p.prd.body }, b);
assert.deepEqual(p.prd, restored);
// An explicit historical restoration creates a new version even for equal text.
await op("prd.restore", { revision: 1 }, b);
assert.equal(p.prd.revision, 4);
assert.equal(p.prd.updatedBy, "seoyeon");
assert.equal(p.prd.history.at(-1).restoredFromRevision, 1);
await op("prd.save", { body: firstBody + "\n수정된 안내" });
assert.equal(p.prd.change, "edited");
assert.equal(p.prd.restoredFromRevision, undefined);
await op("requirement.save", {
  ...p.requirements[0],
  status: "conflict",
  decision: "취소 기한을 다시 논의",
});
const previousBasis = first.sourceRevision;
await op("prd.restore", { revision: 1 }, b);
assert.equal(p.prd.sourceRevision, p.requirementsVersion);
assert.notEqual(p.prd.sourceRevision, previousBasis);
assert.equal(
  p.prd.history.find((entry) => entry.revision === 1).sourceRevision,
  previousBasis,
);
await op("prd.approve", {}, a, 400);
await op("prd.generate");
assert.equal(p.prd.change, "generated");
assert.equal(p.prd.updatedBy, "jimin");
assert.equal(p.prd.restoredFromRevision, undefined);
const stored = structuredClone(p.prd);
await op("project.delete");
await op("project.restore");
assert.deepEqual(p.prd, stored);
const result = {
  at: new Date().toISOString(),
  projectId: p.id,
  checks: [
    "server-owned current author/time/change",
    "previous author/time/basis retained independently from archiver",
    "unchanged save preserves original metadata",
    "restore reads stored body by revision and clears approval",
    "previous histories immutable",
    "invalid/empty/stale restoration rejected atomically",
    "explicit equal-body restoration creates a new traceable version",
    "editing after restore clears origin marker",
    "restored text records current basis but does not override requirement review",
    "generated draft and project recycle preserve provenance",
  ],
  note: "Synthetic API workflow only, no generated business app execution.",
};
await op("project.delete");
writeFileSync(
  "evidence/prd-history-api-result.json",
  JSON.stringify(result, null, 2),
);
console.log(
  "PASS PRD history: authored versus archived metadata, server-owned restoration, unchanged save, immutable snapshots, review gates and CAS.",
);
