import type { Run, RunResultValues, RunSubmissionRevision } from "./types";

export function runResultValues(value: RunResultValues): RunResultValues {
  return {
    files: { ...value.files },
    deletedFiles: [...(value.deletedFiles || [])],
    log: value.log,
    source: value.source,
  };
}

export function runSubmissionSnapshot(run: Run): RunSubmissionRevision {
  return {
    ...runResultValues(run),
    revision: run.submissionRevision || 1,
    at: run.submittedAt,
    authorId: run.submittedBy,
  };
}

export function saveRunSubmission(
  run: Run,
  values: RunResultValues,
  actorId: string,
  at: string,
) {
  const hadResult = !!(
    run.submissionRevision ||
    run.log ||
    run.source ||
    Object.keys(run.files).length ||
    run.deletedFiles?.length
  );
  const paths = Object.keys(run.files);
  const removed = run.deletedFiles || [],
    nextRemoved = values.deletedFiles || [];
  const unchanged =
    hadResult &&
    run.log === values.log &&
    run.source === values.source &&
    paths.length === Object.keys(values.files).length &&
    paths.every(
      (path) =>
        Object.hasOwn(values.files, path) &&
        run.files[path] === values.files[path],
    ) &&
    removed.length === nextRemoved.length &&
    removed.every((path) => nextRemoved.includes(path));
  if (unchanged) return;
  if (hadResult) {
    run.submissionHistory ??= [];
    run.submissionHistory.push(runSubmissionSnapshot(run));
  }
  const revision = hadResult ? (run.submissionRevision || 1) + 1 : 1;
  Object.assign(run, runResultValues(values), {
    submissionRevision: revision,
    submittedAt: at,
    submittedBy: actorId,
  });
}
