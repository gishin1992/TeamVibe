import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
async function login(userId) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
const jimin = await login("jimin"),
  seoyeon = await login("seoyeon");
async function call(cookie, path, body, status = 200) {
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
  jimin,
  "projects",
  {
    name: "대화 출처 연결 · 변경과 검토",
    description:
      "대화 근거를 바꾸어도 이전 연결과 원문 버전을 보존하는 합성 시연",
    goal: "출처 선택과 해제, 팀의 동시 변경을 확인한다.",
  },
  201,
);
p = await call(seoyeon, "join", { code: p.inviteCode });
async function op(type, data = {}, cookie = jimin) {
  p = await call(cookie, "projects/" + p.id, {
    type,
    version: p.version,
    ...data,
  });
}
for (const [cookie, title, text, kind] of [
  [
    jimin,
    "최초 취소 의견",
    "승인을 받기 전에만 신청을 취소하고 싶어요.",
    "user",
  ],
  [
    seoyeon,
    "담당자의 보완 의견",
    "승인 후에도 담당자 확인을 받고 취소할 수 있어야 해요.",
    "user",
  ],
  [
    jimin,
    "취소 정책 정리",
    "취소할 때 처리 상태와 사유를 함께 기록하는 방향을 검토하세요.",
    "chatgpt",
  ],
]) {
  await op("conversation.save", { title }, cookie);
  await op(
    "message.save",
    {
      conversationId: p.conversations.at(-1).id,
      text,
      kind,
      source: kind === "chatgpt" ? "합성 ChatGPT 응답 · 외부 호출 없음" : "",
    },
    cookie,
  );
}
await op("requirement.save", {
  title: "신청 취소 범위",
  description: "취소가 가능한 시점을 정한다.",
  priority: "must",
  status: "accepted",
  decision: "최초 합성 의견을 검토",
  sourceIds: [p.conversations[0].messages[0].id],
});
await op("prd.generate");
await op("prd.approve");
await op("prd.approve", {}, seoyeon);
writeFileSync(
  "evidence/source-links-browser-fixture.json",
  JSON.stringify(p, null, 2),
);
console.log({ projectId: p.id, requirementId: p.requirements[0].id });
