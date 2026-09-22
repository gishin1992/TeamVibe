import type { Project } from "./types";

export type PlannedStory = {
  key: string;
  title: string;
  description: string;
  acceptance: string[];
  tests: string[];
  dependencies: string[];
  existingDependencies: string[];
  requirementIds: string[];
  ownerId: string;
};
export type StoryPlan = {
  planId: string;
  projectId: string;
  prdRevision: number;
  source: string;
  stories: PlannedStory[];
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}: JSON 객체가 필요합니다.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number, optional = false) {
  if (optional && value === undefined) return "";
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!optional && !value.trim())
  )
    throw new Error(
      `${label}: ${max}자 이내의 ${optional ? "" : "비어 있지 않은 "}문자열이 필요합니다.`,
    );
  return value.trim();
}
function list(value: unknown, label: string, required = false): string[] {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || value.length > 40 || (required && !value.length))
    throw new Error(
      `${label}: ${required ? "1~40" : "0~40"}개의 목록이 필요합니다.`,
    );
  const items = value.map((item) => text(item, label, 2000));
  if (new Set(items).size !== items.length)
    throw new Error(`${label}: 같은 항목을 중복해서 넣을 수 없습니다.`);
  return items;
}

export function readStoryPlan(raw: string): unknown {
  if (raw.length > 200000)
    throw new Error("스토리 설계 JSON은 200,000자 이내로 입력하세요.");
  const json = raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1");
  try {
    return JSON.parse(json);
  } catch {
    throw new Error("JSON 형식을 확인해 주세요. 입력은 보존됩니다.");
  }
}

// Both the review screen and the server enforce the same references and DAG.
export function validateStoryPlan(value: unknown, p: Project): StoryPlan {
  const raw = object(value, "스토리 설계");
  const planId = text(raw.planId, "설계 묶음 ID", 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(planId))
    throw new Error("설계 묶음 ID는 영문, 숫자, -와 _만 사용할 수 있습니다.");
  if (raw.projectId !== p.id)
    throw new Error(
      "다른 프로젝트의 스토리 설계입니다. 이 프로젝트의 작업 묶음을 사용하세요.",
    );
  if (raw.prdRevision !== p.prd.revision)
    throw new Error(
      "PRD 버전이 변경되었습니다. 최신 PRD로 스토리 설계를 다시 검토하세요.",
    );
  if (p.storyPlanImports?.some((entry) => entry.id === planId))
    throw new Error(
      "이미 가져온 설계 묶음입니다. 기존 스토리를 수정하거나 휴지통에서 복원하세요.",
    );
  if (
    !Array.isArray(raw.stories) ||
    !raw.stories.length ||
    raw.stories.length > 20
  )
    throw new Error("한 묶음에 스토리를 1~20개 넣어 주세요.");
  const requirements = p.requirements.filter((r) => !r.deletedAt);
  const existing = p.stories.filter((s) => !s.deletedAt);
  const stories = raw.stories.map((value, index): PlannedStory => {
    const item = object(value, `스토리 ${index + 1}`);
    const key = text(item.key, `스토리 ${index + 1} key`, 60);
    if (!/^[a-zA-Z0-9_-]+$/.test(key))
      throw new Error("스토리 key는 영문, 숫자, -와 _만 사용할 수 있습니다.");
    const story: PlannedStory = {
      key,
      title: text(item.title, `${key} 제목`, 200),
      description: text(item.description, `${key} 설명`, 5000),
      acceptance: list(item.acceptance, `${key} 완료 조건`, true),
      tests: list(item.tests, `${key} 테스트 기준`, true),
      dependencies: list(item.dependencies, `${key} 묶음 내 의존성`),
      existingDependencies: list(
        item.existingDependencies,
        `${key} 기존 스토리 의존성`,
      ),
      requirementIds: list(
        item.requirementIds,
        `${key} 연결 요구사항`,
        requirements.length > 0,
      ),
      ownerId: text(item.ownerId, `${key} 담당자`, 100, true),
    };
    if (story.ownerId && !p.members.includes(story.ownerId))
      throw new Error(`${key}: 담당자가 현재 팀 멤버가 아닙니다.`);
    if (
      story.requirementIds.some((id) => !requirements.some((r) => r.id === id))
    )
      throw new Error(`${key}: 연결 요구사항을 찾을 수 없습니다.`);
    if (
      story.existingDependencies.some(
        (id) => !existing.some((s) => s.id === id),
      )
    )
      throw new Error(`${key}: 선행할 기존 스토리를 찾을 수 없습니다.`);
    if (story.dependencies.length + story.existingDependencies.length > 40)
      throw new Error(`${key}: 의존성은 합계 40개 이하여야 합니다.`);
    return story;
  });
  const byKey = new Map(stories.map((s) => [s.key, s]));
  if (byKey.size !== stories.length)
    throw new Error(
      "스토리 key가 중복되었습니다. 각 스토리에 다른 key를 사용하세요.",
    );
  const visited = new Set<string>();
  function visit(key: string, path: Set<string>) {
    if (path.has(key))
      throw new Error(
        `스토리 의존성이 순환합니다: ${[...path, key].join(" → ")}`,
      );
    if (visited.has(key)) return;
    const story = byKey.get(key);
    if (!story)
      throw new Error(`묶음 내 선행 스토리 key를 찾을 수 없습니다: ${key}`);
    for (const dependency of story.dependencies)
      visit(dependency, new Set(path).add(key));
    visited.add(key);
  }
  stories.forEach((s) => visit(s.key, new Set()));
  return {
    planId,
    projectId: p.id,
    prdRevision: p.prd.revision,
    source: text(raw.source, "설계 출처", 1000),
    stories,
  };
}

export function storyPlanPrompt(p: Project, planId: string) {
  const example = {
    planId,
    projectId: p.id,
    prdRevision: p.prd.revision,
    source: "ChatGPT 세션 제목 또는 합성 예제 출처",
    stories: [
      {
        key: "story-a",
        title: "구체적인 사용자 행동",
        description: "사용자로서 하고 싶은 일과 이유",
        acceptance: ["측정 가능한 완료 조건"],
        tests: ["입력, 조작, 예상 결과가 명확한 테스트"],
        dependencies: [],
        existingDependencies: [],
        requirementIds: p.requirements
          .filter((r) => !r.deletedAt)
          .slice(0, 1)
          .map((r) => r.id),
        ownerId: "",
      },
    ],
  };
  return `TeamVibe 사용자 스토리 설계\n프로젝트: ${p.name}\n\n아래 자료를 요구사항으로 읽고, 작고 구현·테스트 가능한 사용자 스토리 1~20개로 나누세요. 구현이나 테스트를 실행했다고 주장하지 마세요. 이 요청은 자동 연결이 아니며 팀원이 결과를 수동으로 가져옵니다.\n\n독립 스토리는 dependencies를 비워 병렬 개발할 수 있게 하고, 실제 선행 관계만 연결하세요. 공통 데이터 계약과 파일 경계는 description에 명시하세요. 생성·수정·취소/삭제, 정상·빈 입력·오류를 완료 조건과 재현 가능한 테스트에 포함하세요. 기존 스토리와 중복 작업은 만들지 마세요. 새 스토리는 백로그로 등록되어 팀이 검토한 후 개발 준비 상태로 바꿉니다.\n\n반환은 아래 형식의 JSON 객체 하나입니다. planId, projectId, prdRevision은 그대로 유지하세요. dependencies에는 같은 묶음의 key, existingDependencies에는 아래 기존 스토리 ID만 넣으세요. requirementIds에는 아래 요구사항 ID를 사용하세요. ownerId는 빈 문자열로 두세요. source에는 세션 제목을 쓰세요. 외부 시스템 연결과 실제 데이터 사용은 금지합니다.\n${JSON.stringify(example, null, 2)}\n\n공동 PRD v${p.prd.revision}:\n${p.prd.body}\n\n요구사항 자료:\n${JSON.stringify(
    p.requirements
      .filter((r) => !r.deletedAt)
      .map(({ id, title, description, decision }) => ({
        id,
        title,
        description,
        decision,
      })),
    null,
    2,
  )}\n\n기존 스토리 자료:\n${JSON.stringify(
    p.stories
      .filter((s) => !s.deletedAt)
      .map(({ id, title, description, status }) => ({
        id,
        title,
        description,
        status,
      })),
    null,
    2,
  )}`;
}
