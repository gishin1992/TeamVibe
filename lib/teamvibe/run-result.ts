import type { Run } from "./types";

export function runResultContext(projectId: string, run: Run) {
  return {
    projectId,
    runId: run.id,
    storyId: run.storyId,
    storyRevision: run.storyRevision || 1,
    prdRevision: run.prdRevision,
    baseReleaseId: run.baseReleaseId ?? null,
  };
}

export function validateRunResultContext(
  raw: unknown,
  projectId: string,
  run: Run,
) {
  if (raw === undefined && !run.resultContextRequired) return;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(
      "결과에 작업 context가 필요합니다. 이 작업의 개발 요청에 있는 context를 그대로 포함한 응답을 가져오세요.",
    );
  const actual = raw as Record<string, unknown>;
  const expected = runResultContext(projectId, run);
  const names = {
    projectId: "프로젝트",
    runId: "개발 작업",
    storyId: "스토리",
    storyRevision: "스토리 버전",
    prdRevision: "PRD 버전",
    baseReleaseId: "시작 릴리스",
  };
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    if (actual[key] !== expected[key])
      throw new Error(
        `결과의 ${names[key]} 정보가 선택한 작업과 다릅니다. 올바른 작업의 응답을 가져오세요.`,
      );
  }
  if (Object.keys(actual).some((key) => !Object.hasOwn(expected, key)))
    throw new Error("context에는 개발 요청에 명시된 필드만 포함하세요.");
}

// Imported result documents contain artifact data, never mutation targets.
export function readRunResult(raw: unknown, projectId: string, run: Run) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("결과 JSON 객체가 필요합니다. 입력은 보존됩니다.");
  const value = raw as Record<string, unknown>;
  const allowed = ["context", "files", "deletedFiles", "log", "source"];
  const extra = Object.keys(value).find((key) => !allowed.includes(key));
  if (extra)
    throw new Error(
      `결과 JSON에 허용되지 않은 필드가 있습니다: ${extra}. context, files, deletedFiles, log, source만 포함하세요.`,
    );
  validateRunResultContext(value.context, projectId, run);
  return {
    ...(value.context !== undefined ? { context: value.context } : {}),
    files: value.files,
    ...(value.deletedFiles !== undefined
      ? { deletedFiles: value.deletedFiles }
      : {}),
    log: value.log,
    source: value.source,
  };
}
