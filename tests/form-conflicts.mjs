import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  compareFields,
  latestFormValues,
} from "../lib/teamvibe/form-conflicts.ts";

const baseline = {
  title: "합성 원본 제목",
  description: "합성 원본 내용",
  decision: "",
};
const independent = compareFields(
  baseline,
  { ...baseline, title: "내 새 제목" },
  { ...baseline, description: "팀의 새 내용" },
);
assert.ok(independent.every((field) => !field.conflict));
assert.deepEqual(
  Object.fromEntries(independent.map((field) => [field.key, field.merged])),
  { title: "내 새 제목", description: "팀의 새 내용", decision: "" },
);
const sameField = compareFields(
  baseline,
  { ...baseline, title: "내 새 제목" },
  { ...baseline, title: "팀의 새 제목" },
);
assert.equal(sameField[0].conflict, true);
assert.equal(sameField[0].before, baseline.title);
assert.equal(sameField[0].latest, "팀의 새 제목");
assert.equal(
  compareFields(
    baseline,
    { ...baseline, title: "공동 제목" },
    { ...baseline, title: "공동 제목" },
  )[0].conflict,
  false,
);
assert.equal(
  compareFields({ title: "원본" }, { title: "" }, { title: "원본" })[0].merged,
  "",
);
const p = {
  id: "fixture",
  name: "프로젝트",
  description: "설명",
  goal: "목표",
  prd: { body: "팀의 PRD" },
  requirements: [
    {
      id: "r1",
      title: "요구사항",
      description: "팀 최신 설명",
      priority: "must",
      decision: "근거",
      status: "proposed",
    },
  ],
  stories: [
    {
      id: "s1",
      title: "스토리",
      status: "done",
      acceptance: ["조건 1", "조건 2"],
      tests: ["검사"],
      dependencies: [],
      requirementIds: ["r1"],
      ownerId: "user",
    },
  ],
  runs: [
    {
      id: "run1",
      storyId: "s1",
      storyRevision: 2,
      prdRevision: 3,
      baseReleaseId: "",
      files: { "index.html": "<h1>fixture</h1>" },
      log: "실행 검증 아님",
      source: "합성",
    },
  ],
  conversations: [
    {
      id: "c1",
      title: "대화",
      messages: [{ id: "m1", text: "최신 메시지", source: "로컬" }],
    },
  ],
};
assert.equal(
  latestFormValues(p, { type: "prd.save" }, { body: "" }).body,
  "팀의 PRD",
);
assert.equal(
  latestFormValues(
    p,
    { type: "story.save", id: "s1" },
    { acceptance: "", status: "backlog" },
  ).acceptance,
  "조건 1\n조건 2",
);
assert.equal(
  latestFormValues(p, { type: "story.save", id: "s1" }, { status: "backlog" })
    .status,
  "keep",
);
assert.equal(
  latestFormValues(
    p,
    { type: "message.save", id: "m1", conversationId: "c1" },
    { text: "", source: "" },
  ).text,
  "최신 메시지",
);
assert.deepEqual(
  JSON.parse(
    latestFormValues(p, { type: "run.submit", id: "run1" }, { payload: "" })
      .payload,
  ),
  {
    context: {
      projectId: "fixture",
      runId: "run1",
      storyId: "s1",
      storyRevision: 2,
      prdRevision: 3,
      baseReleaseId: "",
    },
    files: p.runs[0].files,
    log: "실행 검증 아님",
    source: "합성",
  },
);
assert.deepEqual(
  latestFormValues(p, { type: "requirement.save" }, baseline),
  baseline,
);
assert.equal(
  latestFormValues(p, { type: "requirement.save", id: "missing" }, baseline),
  null,
);
assert.equal(
  latestFormValues(
    { ...p, deletedAt: "2026-09-21" },
    { type: "project.edit" },
    baseline,
  ),
  null,
);
assert.equal(
  latestFormValues(
    {
      ...p,
      conversations: [{ ...p.conversations[0], deletedAt: "2026-09-21" }],
    },
    { type: "message.save", id: "m1", conversationId: "c1" },
    { text: "" },
  ),
  null,
);
writeFileSync(
  "evidence/form-conflicts-result.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      status: "passed",
      checks: [
        "서로 다른 필드 변경 보존",
        "같은 필드 충돌 탐지와 원본/최신 값 보존",
        "동일한 변경은 충돌 없음",
        "빈 값 수정 보존",
        "기존 양식별 서버 값 변환",
        "새 양식 입력 보존",
        "삭제된 항목/프로젝트 재저장 차단",
      ],
      scope: "순수 병합 로직 검증. UI 선택과 실제 저장은 별도 브라우저 검사.",
    },
    null,
    2,
  ),
);
console.log(
  "PASS three-way form comparison, server field mapping, and deleted target guards.",
);
