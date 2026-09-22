import { fixtureResultData } from "../scripts/result-context.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  latestFormValues,
  compareFields,
} from "../lib/teamvibe/form-conflicts.ts";

const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
const cookies = {};
for (const userId of ["jimin", "seoyeon"]) {
  const response = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  assert.equal(response.status, 200);
  cookies[userId] = response.headers.get("set-cookie").split(";")[0];
}
async function call(path, body, status = 200, user = "jimin") {
  const response = await fetch(base + "/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: cookies[user],
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result;
}
let p;
async function op(type, data = {}, status = 200, user = "jimin") {
  const result = await call(
    "projects/" + p.id,
    { type, version: p.version, ...fixtureResultData(p, type, data) },
    status,
    user,
  );
  if (status === 200) p = result;
  else
    assert.deepEqual(
      await call("projects/" + p.id),
      p,
      "거절된 변경은 전체 프로젝트를 보존해야 한다",
    );
  return result;
}
async function release(title, content) {
  await op("story.save", {
    title,
    description: "피드백 생명주기 검증용 합성 안내 화면",
    acceptance: ["안내 문장이 표시된다."],
    tests: ["화면의 안내를 확인한다."],
    dependencies: [],
    requirementIds: [],
    ownerId: "jimin",
    status: "ready",
  });
  await op("run.start", { storyIds: [p.stories.at(-1).id] });
  const id = p.runs.at(-1).id;
  await op("run.submit", {
    id,
    files: { "index.html": content },
    source: "tests/feedback-lifecycle.mjs · 합성",
    log: "API 계약 검증용 합성 코드. 실제 ChatGPT 응답이나 기능 테스트 결과가 아님.",
  });
  await op("release.create", { title, runIds: [id] });
  return p.releases.at(-1).id;
}
async function fixture(name) {
  p = await call(
    "projects",
    {
      name,
      description:
        "릴리스가 바뀐 뒤에도 피드백과 후속 스토리를 추적하는 합성 시연",
      goal: "피드백의 발견 맥락, 후속 작업, 해결 이유를 보존한다.",
    },
    201,
  );
  await op("prd.save", {
    body: "# 합성 안내 화면\n초기 안내와 개선 안내를 표시하고 팀의 피드백을 관리한다.",
  });
  await op("prd.approve");
  const originalRelease = await release(
    "처음 발견한 화면",
    "<h1>합성 안내</h1><p>초기 안내 화면</p>",
  );
  await op("feedback.save", {
    releaseId: originalRelease,
    title: "안내 문구의 개선 범위를 확인해주세요",
    body: "초기 화면의 안내가 모호합니다. 다음 릴리스의 안내를 검토하고 종결 이유를 남겨 주세요.",
    status: "open",
  });
  const feedbackId = p.feedback.at(-1).id;
  await op("feedback.story", { id: feedbackId });
  const linkedStory = p.feedback.at(-1).storyId;
  const currentRelease = await release(
    "안내를 보완한 화면",
    "<h1>합성 안내</h1><p>팀과 확인할 개선 안내 화면</p>",
  );
  await op("item.delete", { collection: "releases", id: originalRelease });
  await op("item.delete", { collection: "stories", id: linkedStory });
  return { originalRelease, currentRelease, feedbackId, linkedStory };
}
const ids = await fixture("피드백 생명주기 검사 " + Date.now());
const originalFeedback = structuredClone(p.feedback[0]);
const saved = (overrides = {}) => ({
  id: ids.feedbackId,
  releaseId: ids.originalRelease,
  title: originalFeedback.title,
  body: originalFeedback.body,
  status: "open",
  ...overrides,
});
await op("feedback.story", { id: ids.feedbackId }, 400);
await op("item.restore", { collection: "stories", id: ids.linkedStory });
assert.equal(p.stories.length, 3);
assert.equal(p.feedback[0].storyId, ids.linkedStory);
await op("feedback.story", { id: ids.feedbackId }, 400);

p = await call("join", { code: p.inviteCode }, 200, "seoyeon");
await op(
  "feedback.save",
  saved({ body: "다른 팀원이 보완한 재현 설명" }),
  200,
  "seoyeon",
);
assert.equal(p.feedback[0].authorId, "jimin");
assert.equal(p.feedback[0].updatedBy, "seoyeon");
assert.equal(p.feedback[0].createdAt, originalFeedback.createdAt);
assert.equal(p.feedback[0].releaseId, ids.originalRelease);
await op("feedback.save", saved({ releaseId: ids.currentRelease }), 400);
await op("feedback.save", saved({ status: "resolved" }), 400);
await op(
  "feedback.save",
  saved({
    status: "resolved",
    resolutionNote: "종결",
    resolutionReleaseId: "missing",
  }),
  400,
);
await op(
  "feedback.save",
  {
    releaseId: ids.originalRelease,
    title: "새 피드백",
    body: "휴지통 릴리스 신규 피드백 차단",
  },
  400,
);

const baseline = {
  title: originalFeedback.title,
  body: originalFeedback.body,
  status: "open",
  resolutionNote: "",
  resolutionReleaseId: "",
};
const firstClosure = saved({
  status: "resolved",
  resolutionNote:
    "안내 문장을 확인하고 팀 논의로 종결함. 실제 업무 기능 검증은 아님.",
  resolutionReleaseId: ids.currentRelease,
});
await op("feedback.save", firstClosure, 200, "seoyeon");
assert.equal(p.feedback[0].resolutionHistory.length, 1);
assert.equal(p.feedback[0].resolutionHistory[0].authorId, "seoyeon");
assert.equal(p.feedback[0].resolutionHistory[0].releaseId, ids.currentRelease);
const latest = latestFormValues(
  p,
  { type: "feedback.save", id: ids.feedbackId },
  baseline,
);
assert.equal(latest.resolutionNote, firstClosure.resolutionNote);
assert.equal(latest.resolutionReleaseId, ids.currentRelease);
const comparison = compareFields(
  baseline,
  { ...baseline, title: "내 제목 수정" },
  latest,
);
assert.equal(
  comparison.find((f) => f.key === "resolutionNote").merged,
  firstClosure.resolutionNote,
);
assert.equal(comparison.find((f) => f.key === "title").merged, "내 제목 수정");
const staleVersion = p.version;
await op("feedback.save", firstClosure);
assert.equal(
  p.feedback[0].resolutionHistory.length,
  1,
  "같은 종결 상태 저장은 해결 이력 중복을 만들지 않는다",
);
await op("feedback.save", { ...saved(), version: staleVersion }, 409);

await op("feedback.save", saved());
assert.equal(
  p.feedback[0].resolutionHistory.length,
  1,
  "다시 열어도 지난 해결 이력을 보존한다",
);
assert.equal(
  latestFormValues(p, { type: "feedback.save", id: ids.feedbackId }, baseline)
    .resolutionNote,
  "",
);
await op("feedback.save", firstClosure);
assert.equal(
  p.feedback[0].resolutionHistory.length,
  2,
  "재종결은 별도 이력이다",
);
await op("feedback.save", {
  ...firstClosure,
  resolutionNote: "두 번째 확인의 근거를 수정했다.",
});
assert.equal(p.feedback[0].resolutionHistory.length, 3);
const retained = structuredClone(p.feedback[0]);
await op("item.delete", { collection: "feedback", id: ids.feedbackId });
await op("feedback.story", { id: ids.feedbackId }, 400);
assert.equal(
  latestFormValues(p, { type: "feedback.save", id: ids.feedbackId }, baseline),
  null,
);
await op("item.restore", { collection: "feedback", id: ids.feedbackId });
assert.deepEqual(p.feedback[0], retained);
await op("feedback.save", {
  releaseId: ids.currentRelease,
  title: "개발 불필요",
  body: "설명으로 해결한 합성 피드백",
  status: "resolved",
  resolutionNote: "요구 범위를 논의하여 개발 없이 종결",
});
const closed = p.feedback.at(-1);
assert.equal(closed.resolutionHistory.length, 1);
assert.equal(closed.resolutionHistory[0].releaseId, "");
await op("feedback.story", { id: closed.id }, 400);
await op("feedback.save", {
  id: closed.id,
  releaseId: ids.currentRelease,
  title: closed.title,
  body: closed.body,
  status: "open",
});
await op("feedback.story", { id: closed.id });
assert.equal(p.stories.at(-1).revision, 1);
await op("project.delete");
writeFileSync(
  "evidence/feedback-lifecycle-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      projectId: p.id,
      status: "passed",
      checks: [
        "보관된 발견 릴리스의 기존 피드백 수정",
        "발견 릴리스 변경 차단",
        "원작성자 보존과 수정자 기록",
        "휴지통 후속 스토리 중복 생성 차단 및 같은 ID 복원",
        "해결 이유와 확인 릴리스 검증",
        "재열기·재종결·수정 이력 보존",
        "동시 편집용 최신 해결 필드 비교",
        "오래된 버전 저장 409 및 거절 변경 원자성",
        "피드백 휴지통·복원 시 연결과 이력 보존",
        "개발 없는 종결 및 재열기 후 후속 스토리 생성",
      ],
      note: "API와 편집 비교 로직 검증. 합성 앱의 업무 동작 실행을 주장하지 않음.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS feedback lifecycle: cross-release provenance, archived story restoration, closure history, CAS, and lossless recycle.",
);

if (process.env.TEAMVIBE_FEEDBACK_BROWSER_FIXTURE === "1") {
  const browserIds = await fixture("릴리스 간 피드백 · 후속 작업 시연");
  writeFileSync(
    "evidence/feedback-browser-project.json",
    JSON.stringify(p, null, 2),
  );
  writeFileSync(
    "evidence/feedback-browser-fixture.json",
    JSON.stringify({ projectId: p.id, ...browserIds }, null, 2),
  );
  console.log("Browser fixture:", p.id);
}
