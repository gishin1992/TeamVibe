import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
async function client(userId) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie").split(";")[0];
  return async (path, data, status = 200) => {
    const r = await fetch(base + "/api/" + path, {
      method: data ? "POST" : "GET",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const body = await r.json();
    assert.equal(r.status, status, JSON.stringify(body));
    return body;
  };
}
const jimin = await client("jimin"),
  seoyeon = await client("seoyeon");
let a = await jimin(
  "projects",
  {
    name: "설계 자료 보존 · 신청 프로젝트",
    description:
      "탭·프로젝트·프로필 전환 중 수동 설계 자료를 보존하는 합성 시연",
    goal: "팀이 검토 중인 요청과 응답을 잃지 않는다.",
  },
  201,
);
a = await seoyeon("join", { code: a.inviteCode });
const op = async (type, data = {}, who = jimin) =>
  (a = await who("projects/" + a.id, { type, version: a.version, ...data }));
await op("conversation.save", { title: "취소 조건 검토" });
await op("message.save", {
  conversationId: a.conversations.at(-1).id,
  text: "직원이 신청 내역을 확인하고 승인 전 신청을 취소할 수 있으면 좋겠어요.",
});
await op("prd.save", {
  body: "# 신청 내역 검토\n\n직원은 합성 신청 목록을 보고 승인 전 취소한다.\n목록과 취소를 별도 스토리로 검토한다.",
});
await op("prd.approve");
await op("prd.approve", {}, seoyeon);
const b = await jimin(
  "projects",
  {
    name: "설계 자료 보존 · 별도 프로젝트",
    description: "프로젝트별 설계 자료 분리 확인용 합성 프로젝트",
    goal: "다른 프로젝트의 설계 자료가 섞이지 않는다.",
  },
  201,
);
const source = a.conversations.at(-1).messages.find((m) => m.kind === "user");
const requirement = {
  batchId: "planning-draft-requirement",
  projectId: a.id,
  projectVersion: a.version,
  source: "합성 수동 응답 · 실제 ChatGPT 호출 없음",
  requirements: [
    {
      key: "cancel",
      title: "승인 전 신청 취소",
      description: "직원은 승인 전 신청을 취소한다.",
      priority: "must",
      status: "proposed",
      reviewNote: "취소 허용 상태를 팀이 검토한다.",
      sourceRefs: [{ messageId: source.id, revision: source.revision || 1 }],
    },
  ],
};
const story = {
  planId: "planning-draft-story",
  projectId: a.id,
  prdRevision: a.prd.revision,
  source: "합성 설계 응답 · 실행 결과가 아님",
  stories: [
    {
      key: "list",
      title: "신청 목록 보기",
      description: "직원이 합성 신청 내역의 품목과 수량을 확인한다.",
      acceptance: ["품목과 수량을 목록에 표시한다."],
      tests: ["합성 신청 2건을 표시하고 각 수량을 비교한다."],
      dependencies: [],
      existingDependencies: [],
      requirementIds: [],
      ownerId: "jimin",
    },
  ],
};
for (const [name, data] of [
  ["before", { a, b }],
  ["requirement", requirement],
  ["story", story],
])
  writeFileSync(
    `evidence/planning-drafts-${name}.json`,
    JSON.stringify(data, null, 2),
  );
console.log(JSON.stringify({ a: a.id, b: b.id }, null, 2));
