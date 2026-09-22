import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  prdApprovalBlockers,
  requirementSourcesChanged,
} from "../lib/teamvibe/prd-review.ts";
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
const owner = await client("jimin"),
  teammate = await client("seoyeon");
let p = await owner(
  "projects",
  {
    name: "요구사항 복원 재검토 검사 " + Date.now(),
    description: "합성 API 상태 검사",
    goal: "보관 중 바뀐 원문의 합의 재검토와 이전 기록 보존",
  },
  201,
);
p = await teammate("join", { code: p.inviteCode });
async function op(type, data = {}, expected = 200, who = owner) {
  const result = await who(
    "projects/" + p.id,
    { type, version: p.version, ...data },
    expected,
  );
  if (expected === 200) p = result;
  else assert.deepEqual(await owner("projects/" + p.id), p);
  return result;
}
await op("conversation.save", { title: "원문" });
const cid = p.conversations[0].id;
await op("message.save", {
  conversationId: cid,
  text: "당일 취소",
  source: "합성 최초 의견",
});
const mid = p.conversations[0].messages[0].id;
await op("requirement.save", {
  title: "취소 기한",
  description: "당일 취소",
  priority: "must",
  status: "accepted",
  decision: "초기 합의",
  sourceIds: [mid],
});
const rid = p.requirements[0].id,
  req = () => p.requirements.find((r) => r.id === rid);
const original = structuredClone(req());
await op("prd.generate");
await op("prd.approve");
await op("prd.approve", {}, 200, teammate);
// Archiving/restoring a source without editing it does not change its meaning.
const agreed = structuredClone(p.prd);
await op("message.delete", { conversationId: cid, id: mid });
await op("message.restore", { conversationId: cid, id: mid });
await op("item.delete", { collection: "conversations", id: cid });
await op("item.restore", { collection: "conversations", id: cid });
assert.deepEqual(p.prd, agreed);
assert.deepEqual(req(), original);
await op("item.delete", { collection: "requirements", id: rid });
const archived = structuredClone(req());
await op("message.save", {
  conversationId: cid,
  id: mid,
  text: "3일 동안 취소",
  source: "합성 변경 의견",
});
assert.deepEqual(
  req(),
  archived,
  "보관된 요구사항은 원문 편집 시 덮어쓰지 않음",
);
const archivedVersion = p.version;
await op("conversation.save", { title: "별도 대화" });
await owner(
  "projects/" + p.id,
  {
    type: "item.restore",
    collection: "requirements",
    id: rid,
    version: archivedVersion,
  },
  409,
);
assert.deepEqual(await owner("projects/" + p.id), p);
const messageBeforeRestore = structuredClone(p.conversations[0].messages[0]);
await op(
  "item.restore",
  { collection: "requirements", id: rid },
  200,
  teammate,
);
assert.equal(req().status, "proposed");
assert.equal(req().revision, 2);
assert.equal(req().change, "restored-for-review");
assert.equal(req().authorId, "jimin");
assert.equal(req().updatedBy, "seoyeon");
assert.equal(req().history[0].status, "accepted");
assert.equal(req().history[0].decision, original.decision);
assert.equal(req().history[0].authorId, "jimin");
assert.equal(req().sourceRevisions[mid], 1);
assert.deepEqual(p.conversations[0].messages[0], messageBeforeRestore);
assert(requirementSourcesChanged(p, req()));
await op("prd.generate");
await op("prd.approve", {}, 400);
// A pre-fix accepted record is blocked by the shared review gate too.
const preFix = structuredClone(p);
preFix.requirements[0].status = "accepted";
assert(
  prdApprovalBlockers(preFix).some((reason) => reason.includes("취소 기한")),
);
const unknown = { ...preFix.requirements[0], sourceRevisions: undefined };
assert.equal(
  requirementSourcesChanged(p, unknown),
  false,
  "버전 미기록은 변경 사실을 추정하지 않음",
);
const beforeRepeat = structuredClone(p);
await op("item.restore", { collection: "requirements", id: rid });
assert.deepEqual(req(), beforeRepeat.requirements[0]);
assert.deepEqual(p.prd, beforeRepeat.prd);
assert.equal(p.requirementsVersion, beforeRepeat.requirementsVersion);
// Already proposed records need no duplicate history on restore.
await op("item.delete", { collection: "requirements", id: rid });
const history = structuredClone(req().history);
await op("item.restore", { collection: "requirements", id: rid });
assert.deepEqual(req().history, history);
await op("requirement.save", {
  ...req(),
  description: "3일 동안 취소",
  decision: "수정 원문 v2를 검토",
  status: "accepted",
});
assert.equal(req().sourceRevisions[mid], 2);
assert.equal(requirementSourcesChanged(p, req()), false);
await op("prd.generate");
await op("prd.approve");
await op("prd.approve", {}, 200, teammate);
const unchanged = structuredClone(req());
await op("item.delete", { collection: "requirements", id: rid });
const once = structuredClone(p);
await op("item.delete", { collection: "requirements", id: rid });
assert.deepEqual(req(), once.requirements[0]);
assert.equal(p.requirementsVersion, once.requirementsVersion);
await op("item.restore", { collection: "requirements", id: rid });
assert.deepEqual(req(), unchanged);
await op("prd.generate");
await op("prd.approve");
const restoredAgreed = structuredClone(p.prd);
await op("item.restore", { collection: "requirements", id: rid });
assert.deepEqual(p.prd, restoredAgreed);
const result = {
  at: new Date().toISOString(),
  projectId: p.id,
  checks: [
    "source archive/restore preserves meaning and agreement",
    "archived requirement unchanged during source edits",
    "restore marks known changed sources for review with original acceptance history",
    "restore actor does not replace original author",
    "source snapshots unchanged until explicit reacceptance",
    "PRD blocks pre-fix accepted records with known stale sources",
    "stale CAS fails atomically",
    "repeated archive/restore does not invalidate PRD or duplicate history",
    "unchanged-source restore preserves requirement",
    "unknown legacy source version not fabricated",
  ],
  note: "Synthetic API and review-helper checks; no generated app execution.",
};
await op("project.delete");
writeFileSync(
  "evidence/requirement-restore-api-result.json",
  JSON.stringify(result, null, 2),
);
console.log(
  "PASS requirement restore: source revision re-review, preserved original acceptance, explicit reacceptance, no-op lifecycle, legacy and CAS.",
);
