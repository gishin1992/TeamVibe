import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  rememberRequirement,
  requirementValues,
} from "../lib/teamvibe/requirement-history.ts";
const legacy = {
  id: "legacy",
  createdAt: "2026-01-01T00:00:00Z",
  title: "이전 요구",
  description: "이전 내용",
  priority: "must",
  status: "accepted",
  decision: "이전 근거",
  sourceIds: ["m"],
  sourceRevisions: { m: 1 },
};
rememberRequirement(legacy, "seoyeon", "edited");
legacy.sourceIds.push("new");
legacy.sourceRevisions.m = 2;
assert.equal(legacy.authorId, undefined);
assert.equal(legacy.history[0].authorId, undefined);
assert.equal(legacy.history[0].change, undefined);
assert.deepEqual(legacy.history[0].sourceIds, ["m"]);
assert.deepEqual(legacy.history[0].sourceRevisions, { m: 1 });
assert.equal(legacy.updatedBy, "seoyeon");
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
async function client(userId) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie").split(";")[0];
  return async (path, body, expected = 200) => {
    const r = await fetch(base + "/api/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Cookie: cookie,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await r.json();
    assert.equal(r.status, expected, JSON.stringify(data));
    return data;
  };
}
const owner = await client("jimin"),
  teammate = await client("seoyeon");
let p = await owner(
  "projects",
  {
    name: "요구사항 변경 이력 검사 " + Date.now(),
    description: "합성 API 상태 검사",
    goal: "이전 결정 근거와 변경 주체를 보존",
  },
  201,
);
p = await teammate("join", { code: p.inviteCode });
async function op(type, values = {}, who = owner, expected = 200) {
  const next = await who(
    "projects/" + p.id,
    { type, version: p.version, ...values },
    expected,
  );
  if (expected === 200) p = next;
  else assert.deepEqual(await owner("projects/" + p.id), p);
}
await op("conversation.save", { title: "원문" });
const cid = p.conversations[0].id;
for (const text of ["승인 전 취소", "담당자 확인 후 취소"])
  await op("message.save", {
    conversationId: cid,
    text,
    kind: "chatgpt",
    source: "합성 응답, AI 미호출",
  });
const [a, b] = p.conversations[0].messages.map((m) => m.id);
await op("requirement.save", {
  title: "취소 범위",
  description: "승인 전에 신청자가 취소한다.",
  priority: "must",
  status: "accepted",
  decision: "초기 범위 합의",
  sourceIds: [a, b],
  authorId: "forged",
  history: [{ title: "forged" }],
  revision: 999,
});
const rid = p.requirements[0].id,
  req = () => p.requirements.find((r) => r.id === rid);
const original = structuredClone(req());
assert.equal(original.authorId, "jimin");
assert.equal(original.revision, 1);
assert.equal(original.history, undefined);
await op("prd.generate");
await op("prd.approve");
await op("prd.approve", {}, teammate);
await op(
  "requirement.save",
  {
    ...req(),
    title: "승인 후 취소 검토",
    description: "담당자 확인 절차를 검토한다.",
    priority: "should",
    status: "conflict",
    decision: "취소 권한에 의견 차이",
    authorId: "forged",
    history: [],
  },
  teammate,
);
assert.equal(req().authorId, "jimin");
assert.equal(req().updatedBy, "seoyeon");
assert.equal(req().revision, 2);
assert.equal(req().change, "edited");
assert.deepEqual(
  requirementValues(req().history[0]),
  requirementValues(original),
);
assert.equal(req().history[0].authorId, "jimin");
assert.equal(p.prd.approvals.length, 0);
const noOp = structuredClone(req());
await op("requirement.save", { ...req() });
assert.deepEqual(req(), noOp);
await op("requirement.save", { ...req(), sourceIds: [b, a] });
assert.deepEqual(req(), { ...noOp, sourceIds: [b, a] });
await op(
  "requirement.save",
  { ...req(), status: "accepted", decision: "담당자가 확인한 후 취소한다." },
  teammate,
);
const beforeSource = structuredClone(req());
await op("message.save", {
  conversationId: cid,
  id: a,
  text: "취소 사유도 남긴다.",
  source: "합성 변경",
});
assert.equal(req().change, "source-updated");
assert.equal(req().status, "proposed");
assert.equal(req().updatedBy, "jimin");
assert.deepEqual(
  requirementValues(req().history.at(-1)),
  requirementValues(beforeSource),
);
assert.equal(req().history.at(-1).authorId, "seoyeon");
const afterSource = structuredClone(req());
await op("message.save", {
  conversationId: cid,
  id: a,
  text: "취소 사유와 담당자를 남긴다.",
  source: "합성 변경",
});
assert.deepEqual(
  req(),
  afterSource,
  "이미 검토 대기이면 같은 요구사항 상태 이력을 중복 기록하지 않음",
);
await op("requirement.save", { ...req(), status: "accepted" });
assert.equal(req().sourceRevisions[a], 3);
assert.equal(req().history.at(-1).sourceRevisions[a], 1);
await op(
  "requirement.import",
  {
    plan: {
      batchId: "history-" + crypto.randomUUID(),
      projectId: p.id,
      projectVersion: p.version,
      source: "합성 수동 반입",
      requirements: [
        {
          key: "reason",
          title: "취소 사유 기록",
          description: "취소 시 사유를 기록한다.",
          priority: "must",
          status: "proposed",
          reviewNote: "함께 검토",
          sourceRefs: [{ messageId: b, revision: 1 }],
        },
      ],
    },
  },
  teammate,
);
const source = structuredClone(p.requirements.at(-1));
assert.equal(source.authorId, "seoyeon");
assert.equal(source.change, "imported");
assert.equal(source.revision, 1);
const beforeMerge = structuredClone(req());
await op(
  "requirement.merge",
  {
    targetId: rid,
    sourceId: source.id,
    title: "취소와 사유 관리",
    description: "담당자가 취소를 확인하고 사유를 남긴다.",
    decision: "중복 절차를 한 요구사항으로 검토",
  },
  teammate,
);
assert.deepEqual(
  requirementValues(req().history.at(-1)),
  requirementValues(beforeMerge),
);
assert.equal(req().change, "merged");
assert.equal(req().updatedBy, "seoyeon");
assert.equal(req().status, "proposed");
const archivedSource = p.requirements.find((r) => r.id === source.id);
assert(archivedSource.deletedAt);
delete archivedSource.deletedAt;
assert.deepEqual(archivedSource, source);
// Refresh the authoritative clone after comparing the archived source without its marker.
p = await owner("projects/" + p.id);
const beforeRecycle = structuredClone(req());
await op("item.delete", { collection: "requirements", id: rid });
await op("item.restore", { collection: "requirements", id: rid });
assert.deepEqual(req(), beforeRecycle);
const version = p.version;
await op("requirement.save", { ...req(), decision: "최종 검토 근거" });
await owner(
  "projects/" + p.id,
  { type: "requirement.save", version, ...req(), title: "오래된 저장" },
  409,
);
assert.deepEqual(await owner("projects/" + p.id), p);
await op(
  "requirement.save",
  { ...req(), status: "accepted", decision: "" },
  owner,
  400,
);
await op(
  "requirement.merge",
  { targetId: rid, sourceId: rid, title: "invalid" },
  owner,
  400,
);
const result = {
  at: new Date().toISOString(),
  projectId: p.id,
  revision: req().revision,
  checks: [
    "full previous values and author preserved before edits",
    "no-op and source ordering do not duplicate history",
    "source changes preserve acceptance and mark re-review",
    "current source version captured only on reacceptance",
    "import author and merge target/source retained",
    "untrusted history metadata ignored",
    "archive/restore and rejected CAS leave history intact",
    "legacy author unknown and nested sources copied",
  ],
  note: "Synthetic API and helper checks; no generated business app execution claimed.",
};
await op("project.delete");
writeFileSync(
  "evidence/requirement-history-api-result.json",
  JSON.stringify(result, null, 2),
);
console.log(
  "PASS requirement history: previous decisions, per-version author, source-change/merge reasons, no-op, archive/restore, CAS and legacy metadata.",
);
