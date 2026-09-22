import type { Project, TestCoverageSnapshot, TestResultValues } from "./types";

// New links must describe the current story version actually included in this release.
export function availableTestCoverage(
  project: Project,
  releaseId: string,
): TestCoverageSnapshot[] {
  const release = project.releases.find(
    (item) => item.id === releaseId && !item.deletedAt,
  );
  if (!release) return [];
  return project.stories
    .filter(
      (story) =>
        !story.deletedAt &&
        project.runs.some(
          (run) =>
            !run.deletedAt &&
            run.status === "integrated" &&
            run.storyId === story.id &&
            (run.storyRevision || 1) === (story.revision || 1) &&
            run.prdRevision === story.prdRevision &&
            release.runIds.includes(run.id),
        ),
    )
    .flatMap((story) =>
      story.tests.map((criterion, index) => ({
        key: `${story.id}:${index}`,
        storyId: story.id,
        storyRevision: story.revision || 1,
        prdRevision: story.prdRevision,
        storyTitle: story.title,
        criterion,
      })),
    );
}

export function recordedCoverageLabel(result: TestResultValues, key: string) {
  const snapshot = result.coverageSnapshots?.find((item) => item.key === key);
  return snapshot
    ? `${snapshot.storyTitle} v${snapshot.storyRevision} / ${snapshot.criterion}`
    : "이전 연결 기준 · 당시 문구 미기록";
}

export function testCoverageOptions(
  project: Project,
  releaseId: string,
  existing?: TestResultValues,
  selected: string[] = existing?.coverage || [],
) {
  const options = availableTestCoverage(project, releaseId).map((item) => ({
    value: item.key,
    label: `${item.storyTitle} v${item.storyRevision} / ${item.criterion}`,
  }));
  for (const key of new Set([...(existing?.coverage || []), ...selected])) {
    if (options.some((option) => option.value === key)) continue;
    const retained = existing?.coverage?.includes(key);
    options.push({
      value: key,
      label: `${existing ? recordedCoverageLabel(existing, key) : "이전 선택 기준"} · ${retained ? "기존 기록, 유지 또는 해제" : "현재 연결할 수 없음, 해제 필요"}`,
    });
  }
  return options;
}
