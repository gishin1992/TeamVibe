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
const owner = await session("jimin"),
  teammate = await session("seoyeon");
async function call(path, body, cookie = owner, status = 200) {
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
    name: "요구사항 결정 이력 · 팀 검토",
    description: "합성 취소 정책의 결정·통합·재검토 기록",
    goal: "이전 합의와 수정 이유를 팀원이 함께 확인한다.",
  },
  owner,
  201,
);
p = await call("join", { code: p.inviteCode }, teammate);
async function op(type, data = {}, cookie = owner) {
  p = await call(
    "projects/" + p.id,
    { type, version: p.version, ...data },
    cookie,
  );
}
await op("conversation.save", { title: "신청 취소 범위" });
await op("message.save", {
  conversationId: p.conversations[0].id,
  text: "승인 전에 신청자가 취소할 수 있어야 합니다.",
});
await op("conversation.save", { title: "관리자의 취소 확인" }, teammate);
await op(
  "message.save",
  {
    conversationId: p.conversations[1].id,
    text: "승인 후에는 담당자가 취소 사유를 확인해야 합니다.",
  },
  teammate,
);
await op("requirement.save", {
  title: "신청자의 취소",
  description: "승인 전 신청자가 직접 취소한다.",
  priority: "must",
  status: "accepted",
  decision: "우선 승인 전 취소만 시연 범위에 포함한다.",
  sourceIds: [p.conversations[0].messages[0].id],
});
await op(
  "requirement.save",
  {
    title: "취소 사유 기록",
    description: "취소할 때 사유를 함께 남긴다.",
    priority: "should",
    status: "accepted",
    decision: "취소 경위를 팀이 확인하기 위해 사유를 기록한다.",
    sourceIds: [p.conversations[1].messages[0].id],
  },
  teammate,
);
await op("prd.generate");
await op("prd.approve");
await op("prd.approve", {}, teammate);
writeFileSync(
  "evidence/requirement-history-browser-before.json",
  JSON.stringify(p, null, 2),
);
console.log(
  JSON.stringify({
    projectId: p.id,
    name: p.name,
    requirementIds: p.requirements.map((r) => r.id),
  }),
);
