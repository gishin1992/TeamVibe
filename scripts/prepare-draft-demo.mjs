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
    name: "대화 초안 · 분리 시연",
    description: "대화·프로젝트·사용자 전환의 합성 입력 검증",
    goal: "전송 전 내용이 다른 대화에 섞이지 않는다.",
  },
  201,
);
p = await call(seoyeon, "join", { code: p.inviteCode });
for (const [cookie, title] of [
  [jimin, "지민의 신청 아이디어"],
  [jimin, "지민의 승인 아이디어"],
  [seoyeon, "서연의 조회 아이디어"],
])
  p = await call(cookie, "projects/" + p.id, {
    type: "conversation.save",
    version: p.version,
    title,
  });
let q = await call(
  jimin,
  "projects",
  {
    name: "대화 초안 · 별도 프로젝트",
    description: "프로젝트 간 입력 분리 합성 검증",
    goal: "다른 프로젝트는 별도 초안을 사용한다.",
  },
  201,
);
q = await call(jimin, "projects/" + q.id, {
  type: "conversation.save",
  version: q.version,
  title: "별도 프로젝트 아이디어",
});
writeFileSync(
  "evidence/draft-browser-fixture.json",
  JSON.stringify(
    {
      projectId: p.id,
      otherProjectId: q.id,
      conversations: p.conversations.map(({ id, title, ownerId }) => ({
        id,
        title,
        ownerId,
      })),
      otherConversationId: q.conversations.at(-1).id,
    },
    null,
    2,
  ),
);
console.log({ projectId: p.id, otherProjectId: q.id });
