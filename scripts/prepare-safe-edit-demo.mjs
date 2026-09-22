import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { fixtureResultData } from "./result-context.mjs";
import { standaloneDocument } from "../lib/teamvibe/sandbox.ts";

const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
async function client(userId) {
  const response = await fetch(base + "/api/session", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  return async (path, body, status = 200) => {
    const response = await fetch(base + "/api/" + path, {
      headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  };
}
const owner = await client("jimin"), support = await client("seoyeon"), developer = await client("hyunwoo");
let p = await owner("projects", {
  name: "비품 신청 · 수정과 취소를 보존하는 시연",
  description: "세 팀원의 합성 비품 신청 앱. 저장 전에는 원래 신청이 유지됩니다.",
  goal: "신청 등록, 기존 수량을 보존한 수정, 수정 취소, 오류 시 원본 유지, 신청 취소를 한 실행 세션에서 확인한다. 외부 연결과 서버 저장은 없다.",
}, 201);
p = await support("join", { code: p.inviteCode });
p = await developer("join", { code: p.inviteCode });
const op = async (type, data = {}, who = owner) => p = await who("projects/" + p.id, {
  type, version: p.version, ...fixtureResultData(p, type, data),
});
for (const [who, title, text] of [
  [owner, "수정 전후의 보존", "수정 버튼을 눌러도 저장 전까지 원래 신청을 유지하고 수정 취소로 돌아갈 수 있어야 해요."],
  [support, "기존 수량과 오류 입력", "기존 수량이 수정 양식에 그대로 들어오고 잘못된 입력으로 원래 신청이 사라지지 않아야 해요."],
  [developer, "독립 작업 경계", "HTML과 JS는 기능 작업, CSS는 별도 스타일 작업으로 나누고 같은 ID와 클래스 계약을 사용해요."],
]) {
  await op("conversation.save", { title }, who);
  await op("message.save", { conversationId: p.conversations.at(-1).id, kind: "user", text }, who);
}
for (const [title, description, decision, source] of [
  ["원본을 보존하는 신청 수정", "품목과 양의 정수 수량을 등록·수정·취소한다. 수정 시작은 기존 신청을 변경하지 않는다.", "기존 값 유지, 수정 취소, 오류 중 원본 유지, 여러 신청 중 대상 구분을 검증한다.", 1],
  ["읽기 쉬운 신청 화면", "모바일과 데스크톱에서 수정 중 상태와 버튼을 구분한다.", "styles.css를 독립 구현한다. 새로고침 시 합성 실행 상태는 초기화된다.", 2],
]) await op("requirement.save", { title, description, decision, sourceIds: [p.conversations[source].messages[0].id], priority: "must", status: "accepted" });
await op("prd.generate");
for (const who of [owner, support, developer]) await op("prd.approve", {}, who);
const tests = [
  "3개 신청의 수정 시작에서 품목·수량3과 원래 목록이 유지되는지 확인한다.",
  "품목과 수량을 바꾼 뒤 수정 취소하면 원래 신청이 유지되는지 확인한다.",
  "공백 품목·0·소수 수량 저장 거절 후 원래 신청과 입력 보존을 확인한다.",
  "수정 저장과 새 신청 추가 후 각각의 수정·신청 취소가 올바른 대상에 적용되는지 확인한다.",
];
await op("story.save", { title: "수정 중 원본과 수량 보존", description: "index.html과 app.js를 구현한다. 신청은 메모리에 저장하고 입력을 텍스트로 표시한다.", acceptance: ["저장 전 원본 보존", "명시적 수정 취소", "양의 정수 수량", "신청별 독립 수정·취소"], tests, dependencies: [], requirementIds: [p.requirements[0].id], ownerId: "hyunwoo", status: "ready" });
await op("story.save", { title: "모바일 수정 화면", description: "styles.css만 구현한다. 폼과 목록이390px에서도 잘리지 않는다.", acceptance: ["모바일에서 입력·수정 취소·목록을 읽고 조작할 수 있다."], tests: ["390px 화면에서 수정 입력·취소 버튼·목록 표시와 가로 넘침을 확인한다."], dependencies: [], requirementIds: [p.requirements[1].id], ownerId: "jimin", status: "ready" });
await op("run.start", { storyIds: p.stories.map(s => s.id) });
const files = Object.fromEntries(["index.html", "app.js", "styles.css"].map(name => [name, readFileSync("data/demo-safe-edit/" + name, "utf8")]));
await op("run.submit", { id: p.runs[0].id, files: { "index.html": files["index.html"], "app.js": files["app.js"] }, log: "합성 샘플의 수정 시 원본 손실을 보완했다. 반입 시점 실제 브라우저 검증 전.", source: "data/demo-safe-edit · Codex 로컬 합성 코드, 외부 AI 호출 없음" });
await op("run.submit", { id: p.runs[1].id, files: { "styles.css": files["styles.css"] }, log: "합성 반응형 CSS 작성. 반입 시점 실제 화면 검증 전.", source: "data/demo-safe-edit · Codex 로컬 합성 CSS" });
await op("release.create", { title: "수정 전 원본 보존 · 합성 시연 v2", runIds: p.runs.map(r => r.id) });
writeFileSync("evidence/safe-edit-preparation.json", JSON.stringify({ at: new Date().toISOString(), projectId: p.id, note: "새 합성 프로젝트를 API로 준비. 기존 대표 프로젝트는 변경하지 않음. 아직 실제 테스트 기록과 완료 처리는 없음." }, null, 2));
writeFileSync("evidence/safe-edit-before-tests.json", JSON.stringify(p, null, 2));
writeFileSync("evidence/safe-edit-preview.html", standaloneDocument(files, p.releases.at(-1).title));
console.log(JSON.stringify({ projectId: p.id, version: p.version, tests: 0, preview: "evidence/safe-edit-preview.html" }));
