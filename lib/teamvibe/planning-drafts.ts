// Manual ChatGPT handoff material lives only in the current workspace page.
export type PlanningKind = "requirements" | "stories";
export type PlanningDraft = {
  raw: string;
  prompt: { text: string; version: number } | null;
};
export type PlanningDrafts = Record<string, PlanningDraft>;
export type PlanningDraftEditor = {
  draft: PlanningDraft;
  onDraftChange: (change: Partial<PlanningDraft>) => void;
  onDraftClear: (submitted?: PlanningDraft) => void;
};
export const emptyPlanningDraft: PlanningDraft = { raw: "", prompt: null };

export function planningDraftKey(
  userId: string,
  projectId: string,
  kind: PlanningKind,
) {
  return JSON.stringify([userId, projectId, kind]);
}

export function editPlanningDraft(
  drafts: PlanningDrafts,
  key: string,
  change: Partial<PlanningDraft>,
): PlanningDrafts {
  return {
    ...drafts,
    [key]: { ...(drafts[key] || emptyPlanningDraft), ...change },
  };
}

export function clearPlanningDraft(
  drafts: PlanningDrafts,
  key: string,
  submitted?: PlanningDraft,
): PlanningDrafts {
  // A late import may only clear the exact draft it submitted.
  if (submitted && drafts[key] !== submitted) return drafts;
  if (!drafts[key]) return drafts;
  const next = { ...drafts };
  delete next[key];
  return next;
}
