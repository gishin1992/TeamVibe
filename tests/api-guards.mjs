import { fixtureResultData } from "../scripts/result-context.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
const report = [];
async function login(userId) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return r.headers.get("set-cookie").split(";")[0];
}
const tokens = {
  a: await login("jimin"),
  b: await login("seoyeon"),
  c: await login("hyunwoo"),
};
async function call(path, body, { as = "a", status = 200, headers = {} } = {}) {
  const r = await fetch(base + "/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: tokens[as],
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const raw = await r.text();
  let d;
  try {
    d = JSON.parse(raw);
  } catch {
    d = { error: raw };
  }
  assert.equal(r.status, status, JSON.stringify(d));
  return d;
}
let p = await call(
  "projects",
  {
    name: "API 경계 검사 · 가상 검증 결과 " + Date.now(),
    description:
      "테스트 기록의 데이터 연결 규칙을 검증하는 자동화 전용 프로젝트. 브라우저 실행 결과가 아님.",
    goal: "권한과 데이터 무결성 검사",
  },
  { status: 201 },
);
const op = async (type, body = {}, options = {}) => {
  const out = await call(
    "projects/" + p.id,
    { type, version: p.version, ...fixtureResultData(p, type, body) },
    options,
  );
  if (!options.status || options.status === 200) p = out;
  return out;
};
const pass = (name) => {
  report.push({ name, status: "passed" });
  console.log("PASS " + name);
};
try {
  await call(
    "projects/" + p.id,
    { type: "project.delete", version: p.version },
    { headers: { Origin: "https://untrusted.invalid" }, status: 403 },
  );
  pass("다른 Origin에서 변경 요청 차단");
  await op(
    "requirement.save",
    {
      title: "신청",
      description: "합성 품목을 등록한다.",
      priority: "must",
      status: "accepted",
      decision: "신청을 테스트한다.",
      sourceIds: ["missing"],
    },
    { status: 400 },
  );
  await op("requirement.save", {
    title: "신청",
    description: "합성 품목을 등록한다.",
    priority: "must",
    status: "accepted",
    decision: "신청을 테스트한다.",
    sourceIds: [],
  });
  await op("prd.generate");
  await op("prd.approve");
  await op("requirement.save", {
    ...p.requirements[0],
    description: "수량 입력도 지원한다.",
  });
  assert.equal(p.prd.approvals.length, 0);
  await op("prd.approve", {}, { status: 400 });
  await op("prd.save", { body: p.prd.body + "\n수량 필드 추가 반영" });
  await op("prd.approve");
  pass("요구사항 변경 시 승인 해제, PRD 반영 전 재승인 차단");
  const makeStory = async (title, deps = []) => {
    await op("story.save", {
      title,
      description: "사용자로서 " + title,
      acceptance: ["동작을 확인할 수 있다."],
      tests: ["등록 검증", "취소 검증"],
      ownerId: "jimin",
      status: "ready",
      dependencies: deps,
      requirementIds: [],
    });
    return p.stories.at(-1);
  };
  const s1 = await makeStory("독립 A"),
    s2 = await makeStory("의존 B", [s1.id]);
  await op("story.save", { ...s1, dependencies: [s2.id] }, { status: 400 });
  const blockedStart = await op(
    "run.start",
    { storyIds: [s1.id, s2.id] },
    { status: 400 },
  );
  assert.ok(
    blockedStart.error.includes(s1.title) &&
      blockedStart.error.includes(s2.title),
    "시작 차단 사유에 대상과 선행 스토리 이름을 표시한다",
  );
  assert.equal(p.runs.length, 0);
  await op(
    "item.delete",
    { collection: "stories", id: s1.id },
    { status: 400 },
  );
  pass("순환 의존성, 미완료 선행 작업, 의존 항목 삭제 차단");
  await op("run.start", { storyIds: [s1.id] });
  const r = p.runs.at(-1);
  await op("run.start", { storyIds: [s1.id] }, { status: 400 });
  await op("story.save", { ...s1 }, { status: 400 });
  await op("run.submit", {
    id: r.id,
    files: { "index.html": "<h1>API 계약 검사 fixture</h1>" },
    log: "이 기록은 API 검증 fixture이며 브라우저 실행한 결과가 아니다.",
    source: "tests/api-guards.mjs",
  });
  await op("release.create", { title: "계약 검증 fixture", runIds: [r.id] });
  const release = p.releases.at(-1);
  pass("중복 작업 시작과 진행 중 스토리 변경 차단");
  const test = {
    releaseId: release.id,
    title: "API fixture · 브라우저 실행 아님",
    steps: "테스트 상태 연결 API 호출",
    expected: "입력한 상태 저장",
    actual:
      "자동화의 상태 연결 검사 fixture. 제품 브라우저 실행 결과가 아니다.",
    status: "passed",
    coverage: [],
  };
  await op("test.save", { ...test, coverage: ["unknown:0"] }, { status: 400 });
  await op("test.save", test);
  await op("story.complete", { id: s1.id }, { status: 400 });
  await op("test.save", {
    ...test,
    id: p.testResults.at(-1).id,
    coverage: [s1.id + ":0"],
  });
  await op("story.complete", { id: s1.id }, { status: 400 });
  await op("test.save", {
    ...test,
    id: p.testResults.at(-1).id,
    coverage: [s1.id + ":0", s1.id + ":1"],
  });
  await op("story.complete", { id: s1.id });
  assert.equal(p.stories.find((s) => s.id === s1.id).status, "done");
  pass("스토리의 모든 테스트 기준에 통과 기록을 연결해야 완료 허용");
  const evidenceId = p.testResults.at(-1).id;
  await op("item.delete", { collection: "testResults", id: evidenceId });
  assert.equal(p.stories.find((s) => s.id === s1.id).status, "review");
  await op("run.start", { storyIds: [s2.id] }, { status: 400 });
  await op("item.restore", { collection: "testResults", id: evidenceId });
  await op("story.complete", { id: s1.id });
  await op("test.save", {
    ...test,
    id: evidenceId,
    coverage: [s1.id + ":0", s1.id + ":1"],
    status: "failed",
  });
  assert.equal(p.stories.find((s) => s.id === s1.id).status, "review");
  await op("test.save", {
    ...test,
    id: evidenceId,
    coverage: [s1.id + ":0", s1.id + ":1"],
  });
  await op("story.complete", { id: s1.id });
  pass("완료 근거 삭제·실패 변경 시 재검토 전환과 후속 개발 차단");
  await op("run.start", { storyIds: [s2.id] });
  await op("run.cancel", { id: p.runs.at(-1).id });
  await op("item.delete", { collection: "runs", id: p.runs.at(-1).id });
  await op("item.restore", { collection: "runs", id: p.runs.at(-1).id });
  pass("선행 스토리 완료 후 후속 개발 시작, 작업 취소와 복원");
  await op("conversation.save", { title: "메시지 복원 검사" });
  const conv = p.conversations.at(-1);
  await op("message.save", {
    conversationId: conv.id,
    text: "삭제 및 복원할 합성 메시지",
    kind: "user",
  });
  const msg = p.conversations.at(-1).messages[0];
  await op("message.delete", { conversationId: conv.id, id: msg.id });
  await op("message.restore", { conversationId: conv.id, id: msg.id });
  assert.ok(!p.conversations.at(-1).messages[0].deletedAt);
  pass("메시지 삭제 후 원문 복원");
  p = await call("join", { code: p.inviteCode }, { as: "b" });
  await op(
    "project.edit",
    { name: "권한 초과", description: "", goal: "오너 아님" },
    { as: "b", status: 403 },
  );
  await op("owner.transfer", { userId: "seoyeon" });
  await op(
    "project.edit",
    { name: "이전 오너", description: "", goal: "권한 검사" },
    { status: 403 },
  );
  await op("member.leave");
  await call("projects/" + p.id, undefined, { status: 403 });
  p = await call("join", { code: p.inviteCode });
  await op("owner.transfer", { userId: "jimin" }, { as: "b" });
  pass("프로젝트 오너 이전, 팀 나가기, 이전 권한 회수, 재참여");
  const oldCode = p.inviteCode;
  await op("invite.rotate");
  await call("join", { code: oldCode }, { as: "c", status: 404 });
  pass("초대 코드 재발급 후 기존 코드 무효화");
  writeFileSync(
    "evidence/api-guards-result.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        base,
        projectId: p.id,
        report,
        note: "API 계약 검증용 합성 fixture. 앱 브라우저 기능 검증으로 간주하지 않음.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  writeFileSync(
    "evidence/api-guards-failure.json",
    JSON.stringify(
      { at: new Date().toISOString(), report, error: String(error) },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
