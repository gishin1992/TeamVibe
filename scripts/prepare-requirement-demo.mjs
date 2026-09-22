import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
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
async function call(path, body, cookie = jimin, status = 200) {
  const r = await fetch(base + "/api/" + path, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  assert.equal(r.status, status, JSON.stringify(d));
  return d;
}
let p = await call(
  "projects",
  {
    name: "팀 대화에서 요구사항 · 합성 반입",
    description: "서로 다른 취소 의견을 임의로 합의하지 않고 공동 검토한다.",
    goal: "여러 팀원의 대화 출처를 보존하며 요구사항 초안을 만든다.",
  },
  jimin,
  201,
);
p = await call("join", { code: p.inviteCode }, seoyeon);
async function op(type, data = {}, cookie = jimin) {
  p = await call(
    "projects/" + p.id,
    { type, version: p.version, ...data },
    cookie,
  );
}
for (const [cookie, title, text] of [
  [
    jimin,
    "신청자의 관점",
    "비품 신청에서 품목은 필수이고 수량은 1 이상이어야 해요. 승인을 받기 전에는 신청을 수정하거나 취소하고 싶어요.",
  ],
  [
    seoyeon,
    "관리 담당자의 관점",
    "승인 후에도 신청자의 취소 요청을 받아 담당자가 확인하면 취소할 수 있어야 해요. 모든 취소 이유를 기록하고 싶어요.",
  ],
]) {
  await op("conversation.save", { title }, cookie);
  await op(
    "message.save",
    { conversationId: p.conversations.at(-1).id, text },
    cookie,
  );
}
await op("requirement.save", {
  title: "품목과 수량 입력 확인",
  description: "품목은 필수이고 수량은 1 이상이어야 한다.",
  priority: "must",
  status: "accepted",
  decision: "두 사람이 확인한 합성 입력 기준",
  sourceIds: [p.conversations[0].messages[0].id],
});
await op("prd.generate");
await op("prd.approve");
await op("prd.approve", {}, seoyeon);
const refs = p.conversations.map((c) => ({
  messageId: c.messages[0].id,
  revision: 1,
}));
const plan = {
  batchId: "synthetic-requirements-" + crypto.randomUUID(),
  projectId: p.id,
  projectVersion: p.version,
  source: "Codex 로컬 합성 응답 · 실제 ChatGPT 호출 없음",
  requirements: [
    {
      key: "edit-request",
      title: "신청 수정과 취소",
      description:
        "신청자는 자신의 신청을 수정하거나 취소하고 변경된 상태를 확인한다.",
      priority: "must",
      status: "proposed",
      reviewNote: "수정 가능 시점과 항목을 검토한다.",
      sourceRefs: [refs[0]],
    },
    {
      key: "cancel-conflict",
      title: "승인 후 취소 가능 범위",
      description: "승인 이후 취소 허용 여부와 담당자 확인 절차를 결정한다.",
      priority: "should",
      status: "conflict",
      reviewNote:
        "승인 전까지만 취소할지, 승인 후에도 담당자 확인으로 허용할지 결정해야 한다. 취소 이유 기록 범위도 확인한다.",
      sourceRefs: refs,
    },
  ],
};
writeFileSync(
  "evidence/requirement-browser-fixture.json",
  JSON.stringify({ project: p, plan }, null, 2),
);
writeFileSync(
  "data/sample-requirement-plan.json",
  JSON.stringify(plan, null, 2),
);
console.log({ projectId: p.id, version: p.version });
