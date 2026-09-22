// Synthetic fixture preparation helper. It does not submit or modify anything.
export function fixtureResultData(project, type, data) {
  if (type !== "run.submit" || data.context !== undefined) return data;
  const run = project.runs.find((item) => item.id === data.id);
  if (!run) throw new Error("Fixture run is missing");
  return {
    ...data,
    context: {
      projectId: project.id,
      runId: run.id,
      storyId: run.storyId,
      storyRevision: run.storyRevision || 1,
      prdRevision: run.prdRevision,
      baseReleaseId: run.baseReleaseId ?? null,
    },
  };
}
