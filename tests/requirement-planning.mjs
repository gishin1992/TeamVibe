import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  requirementPlanPrompt,
  readRequirementPlan,
  requirementMessages,
} from "../lib/teamvibe/requirement-plan.ts";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
async function session(userId) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
const jimin = await session("jimin"),
  seoyeon = await session("seoyeon");
async function call(path, body, status = 200, cookie = jimin) {
  const r = await fetch(base + "/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: cookie,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  assert.equal(r.status, status, JSON.stringify(d));
  return d;
}
let p = await call(
  "projects",
  {
    name: "요구사항 정리 계약 검사 " + Date.now(),
    description: "API 상태 규칙 합성 검사",
    goal: "팀 대화의 원문 버전과 미합의 상태를 보존한다.",
  },
  201,
);
p = await call("join", { code: p.inviteCode }, 200, seoyeon);
async function op(type, data = {}, status = 200, cookie = jimin) {
  const d = await call(
    "projects/" + p.id,
    { type, version: p.version, ...data },
    status,
    cookie,
  );
  if (status === 200) p = d;
  else
    assert.deepEqual(
      await call("projects/" + p.id),
      p,
      "거절한 묶음은 부분 저장되지 않는다.",
    );
  return d;
}
for (const [cookie, title, content] of [
  [jimin, "신청 관점", "신청을 작성하고 승인 전에는 취소하고 싶어요."],
  [
    seoyeon,
    "관리 관점",
    "승인 뒤에도 담당자 확인을 받고 취소할 수 있어야 해요.",
  ],
]) {
  await op("conversation.save", { title }, 200, cookie);
  await op(
    "message.save",
    { conversationId: p.conversations.at(-1).id, text: content },
    200,
    cookie,
  );
}
const sources = requirementMessages(p);
assert.equal(sources.length, 2);
assert.equal(p.conversations.flatMap((c) => c.messages).length, 4);
await op("requirement.save", {
  title: "기존 입력 확인",
  description: "빈 신청은 저장하지 않는다.",
  priority: "must",
  status: "accepted",
  decision: "기존 합의 보존",
  sourceIds: [],
});
await op("prd.generate");
await op("prd.approve");
await op("prd.approve", {}, 200, seoyeon);
const originalReq = structuredClone(p.requirements[0]),
  originalPRD = p.prd.body;
function plan(batchId = "batch-" + crypto.randomUUID()) {
  return {
    batchId,
    projectId: p.id,
    projectVersion: p.version,
    source: "tests/requirement-planning.mjs 합성 제안 · 실제 ChatGPT 응답 아님",
    requirements: [
      {
        key: "request",
        title: "신청 작성과 취소",
        description: "신청자가 요청을 작성하고 정해진 조건에서 취소한다.",
        priority: "must",
        status: "proposed",
        reviewNote: "수정 가능한 항목 확인",
        sourceRefs: [{ messageId: sources[0].messageId, revision: 1 }],
      },
      {
        key: "cancel-policy",
        title: "승인 후 취소 정책",
        description: "승인 후 취소 가능 여부와 담당자 확인 절차를 결정한다.",
        priority: "should",
        status: "conflict",
        reviewNote:
          "승인 전까지만 허용할지, 승인 후 담당자 확인으로 허용할지 팀에서 결정한다.",
        sourceRefs: sources.map((m) => ({
          messageId: m.messageId,
          revision: m.revision,
        })),
      },
    ],
  };
}
const prompt = requirementPlanPrompt(p, "prompt-test");
assert(prompt.includes(sources[0].messageId));
assert(prompt.includes(sources[1].messageId));
assert(!prompt.includes("로컬 진행 도우미:"));
assert(prompt.includes("기존 입력 확인"));
const parsed = plan("parse-test");
assert.deepEqual(
  readRequirementPlan("```json\n" + JSON.stringify(parsed) + "\n```"),
  parsed,
);
assert.throws(() => readRequirementPlan("{invalid"), /JSON/);
assert.throws(() => readRequirementPlan(" ".repeat(200001)), /200,000/);
const invalids = [
  [
    "other-project",
    (v) => {
      v.projectId = "other";
    },
  ],
  [
    "old-context",
    (v) => {
      v.projectVersion--;
    },
  ],
  [
    "automatic-agreement",
    (v) => {
      v.requirements[0].status = "accepted";
    },
  ],
  [
    "coerced-enum",
    (v) => {
      v.requirements[0].priority = ["must"];
    },
  ],
  [
    "missing-conflict-note",
    (v) => {
      v.requirements[1].reviewNote = "";
    },
  ],
  [
    "foreign-source",
    (v) => {
      v.requirements[1].sourceRefs[0].messageId = "outside";
    },
  ],
  [
    "guide-source",
    (v) => {
      v.requirements[1].sourceRefs[0].messageId =
        p.conversations[0].messages[1].id;
    },
  ],
  [
    "old-source-revision",
    (v) => {
      v.requirements[1].sourceRefs[0].revision = 0;
    },
  ],
  [
    "repeated-source",
    (v) => {
      v.requirements[1].sourceRefs.push(v.requirements[1].sourceRefs[0]);
    },
  ],
  [
    "repeated-key",
    (v) => {
      v.requirements[1].key = v.requirements[0].key;
    },
  ],
  [
    "empty-batch",
    (v) => {
      v.requirements = [];
    },
  ],
  [
    "too-many-items",
    (v) => {
      v.requirements = Array.from({ length: 21 }, (_, i) => ({
        ...v.requirements[0],
        key: "r" + i,
      }));
    },
  ],
];
for (const [name, change] of invalids) {
  const value = plan();
  change(value);
  await op("requirement.import", { plan: value }, 400);
}
await op("message.delete", {
  conversationId: p.conversations[0].id,
  id: sources[0].messageId,
});
await op("requirement.import", { plan: plan() }, 400);
await op("message.restore", {
  conversationId: p.conversations[0].id,
  id: sources[0].messageId,
});
await op(
  "item.delete",
  { collection: "conversations", id: p.conversations[1].id },
  200,
  seoyeon,
);
await op("requirement.import", { plan: plan() }, 400);
await op(
  "item.restore",
  { collection: "conversations", id: p.conversations[1].id },
  200,
  seoyeon,
);
await op("message.save", {
  conversationId: p.conversations[0].id,
  id: sources[0].messageId,
  text: "申請の修正も必要です。合成の更新。",
});
await op("requirement.import", { plan: plan() }, 400);
const valid = plan("accepted-batch");
for (const r of valid.requirements)
  for (const ref of r.sourceRefs)
    if (ref.messageId === sources[0].messageId) ref.revision = 2;
await op("requirement.import", { plan: valid }, 200, seoyeon);
assert.deepEqual(p.requirements[0], originalReq);
assert.equal(p.prd.body, originalPRD);
assert.equal(p.prd.approvals.length, 0);
assert.deepEqual(
  p.requirements.slice(1).map((r) => r.status),
  ["proposed", "conflict"],
);
assert.equal(p.requirements[2].sourceRevisions[sources[0].messageId], 2);
assert.equal(p.requirements[2].sourceRevisions[sources[1].messageId], 1);
assert.equal(p.requirementImports[0].requirementIds.length, 2);
await op(
  "requirement.import",
  { plan: { ...valid, projectVersion: p.version } },
  400,
);
const importedId = p.requirements[1].id,
  provenance = structuredClone(p.requirements[1].extractionSource);
await op("requirement.save", {
  ...p.requirements[1],
  id: importedId,
  title: "편집한 신청 요구사항",
  status: "accepted",
  decision: "합성 범위를 팀이 검토했다는 API 상태 fixture",
});
assert.deepEqual(p.requirements[1].extractionSource, provenance);
await op("item.delete", { collection: "requirements", id: importedId });
await op(
  "requirement.import",
  { plan: { ...valid, projectVersion: p.version } },
  400,
);
await op("item.restore", { collection: "requirements", id: importedId });
assert.deepEqual(p.requirements[1].extractionSource, provenance);
await op("prd.generate");
await op("prd.approve", {}, 400);
const current = requirementMessages(p);
const updatedPlan = plan("context-update");
for (const r of updatedPlan.requirements)
  for (const ref of r.sourceRefs)
    ref.revision = current.find((m) => m.messageId === ref.messageId).revision;
const oldVersion = p.version;
await op("conversation.save", { title: "검토 이후 다른 팀의 새 대화" });
await call(
  "projects/" + p.id,
  { type: "requirement.import", version: oldVersion, plan: updatedPlan },
  409,
);
assert.deepEqual(await call("projects/" + p.id), p);
await op("requirement.import", { plan: updatedPlan }, 400);
const result = {
  at: new Date().toISOString(),
  projectId: p.id,
  invalidCases: invalids.map(([name]) => name),
  verified: [
    "atomic rejection",
    "cross-member message provenance",
    "source editing/deletion and conversation archive guards",
    "no automatic approval",
    "duplicate batch rejection after archive",
    "edit/archive/restore provenance preservation",
    "CAS and stale context rejection",
  ],
  note: "Synthetic API state tests, not actual ChatGPT execution or browser validation.",
};
await op("project.delete");
writeFileSync(
  "evidence/requirement-planning-api-result.json",
  JSON.stringify(result, null, 2),
);
console.log(
  "PASS requirement planning: atomic proposals, current conversation sources, explicit conflicts, stale/duplicate guards and preserved lifecycle.",
);
