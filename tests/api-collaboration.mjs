import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
const r = await fetch(base + "/api/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: "jimin" }),
});
const cookie = r.headers.get("set-cookie").split(";")[0];
async function call(path, body, status = 200) {
  const res = await fetch(base + "/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: cookie,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await res.json();
  assert.equal(res.status, status, JSON.stringify(d));
  return d;
}
let p = await call(
  "projects",
  {
    name: "협업 일관성 검사 " + Date.now(),
    description: "동시 수정과 요구사항 병합용 합성 프로젝트",
    goal: "같은 버전에서 변경해도 하나만 반영된다.",
  },
  201,
);
const projectId = p.id;
const results = await Promise.all(
  Array.from({ length: 5 }, (_, i) =>
    fetch(base + "/api/projects/" + p.id, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "conversation.save",
        version: p.version,
        title: "동시 작성 " + i,
      }),
    }),
  ),
);
assert.equal(results.filter((r) => r.status === 200).length, 1);
assert.equal(results.filter((r) => r.status === 409).length, 4);
p = await call("projects/" + p.id);
assert.equal(p.conversations.length, 1);
const op = async (type, body = {}) =>
  (p = await call("projects/" + p.id, { type, version: p.version, ...body }));
await op("message.save", {
  conversationId: p.conversations[0].id,
  text: "직원의 장비 신청을 한곳에서 관리한다.",
  kind: "user",
});
const message = p.conversations[0].messages[0];
await op("message.save", {
  conversationId: p.conversations[0].id,
  text: "신청 시 사용 목적도 필요합니다.",
  kind: "user",
});
const secondMessage = p.conversations[0].messages.find(
  (m) => m.text === "신청 시 사용 목적도 필요합니다.",
);
await op("requirement.save", {
  title: "장비 신청 등록",
  description: "품목과 수량을 입력한다.",
  priority: "must",
  status: "accepted",
  decision: "필수 입력을 검사한다.",
  sourceIds: [message.id],
});
const target = p.requirements.at(-1);
await op("requirement.save", {
  title: "물품 요청 등록",
  description: "사용 목적도 함께 입력한다.",
  priority: "should",
  status: "proposed",
  decision: "중복 후보",
  sourceIds: [message.id, secondMessage.id],
});
const source = p.requirements.at(-1);
await op("story.save", {
  title: "신청 등록",
  description: "직원이 신청을 등록한다.",
  acceptance: ["신청이 저장된다."],
  tests: ["필수 입력 검사"],
  status: "backlog",
  dependencies: [],
  ownerId: "",
  requirementIds: [source.id],
});
await op("requirement.merge", {
  targetId: target.id,
  sourceId: source.id,
  title: "통합 비품 신청",
  description: "품목, 수량, 사용 목적을 입력해 신청한다.",
  decision: "동일한 업무 흐름이므로 합치고 검토한다.",
});
assert.ok(p.requirements.find((r) => r.id === source.id).deletedAt);
assert.equal(
  p.requirements.find((r) => r.id === target.id).sourceIds.length,
  2,
);
assert.equal(p.requirements.find((r) => r.id === target.id).status, "proposed");
assert.deepEqual(p.stories[0].requirementIds, [target.id]);
assert.equal(p.conversations[0].messages[0].text, message.text);
const merged = p.requirements.find((r) => r.id === target.id);
await op("requirement.save", {
  id: merged.id,
  title: merged.title,
  description: "내용만 수정해도 출처는 보존한다.",
  priority: merged.priority,
  status: merged.status,
  decision: merged.decision,
});
assert.deepEqual(
  p.requirements.find((r) => r.id === target.id).sourceIds,
  merged.sourceIds,
);
await op("project.delete");
assert.ok(p.deletedAt);
writeFileSync(
  "evidence/collaboration-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      projectId,
      result: "passed",
      checks: [
        "실제 동시 요청 5개 중 1개 저장, 4개 충돌",
        "중복 요구사항 통합 후 원문 보존",
        "출처 중복 제거",
        "출처를 생략한 편집에서 기존 출처 보존",
        "연결 스토리 참조 재연결",
        "통합 요구사항 재검토 상태",
        "검증 전용 프로젝트 휴지통 보관",
      ],
    },
    null,
    2,
  ),
);
console.log(
  "PASS atomic concurrent updates and requirements merge with preserved provenance.",
);
