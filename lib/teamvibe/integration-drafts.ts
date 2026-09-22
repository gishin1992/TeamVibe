import type { FileResolution } from "./integration";

export type IntegrationDraft = {
  title: string;
  version: number | null;
  resolutions: Record<string, FileResolution>;
  chosenPaths: string[];
  resolutionSource: string;
  transferPrompt: { text: string; version: number } | null;
  transferRaw: string;
};
export type IntegrationDrafts = Record<string, IntegrationDraft>;
export type IntegrationDraftChange =
  | Partial<IntegrationDraft>
  | ((current: IntegrationDraft) => Partial<IntegrationDraft>);
export type IntegrationDraftEditor = {
  draft: IntegrationDraft;
  onDraftChange: (change: IntegrationDraftChange) => void;
  onDraftClear: (submitted: IntegrationDraft) => void;
};

export function integrationDraftKey(
  userId: string,
  projectId: string,
  runIds: string[],
) {
  return JSON.stringify([userId, projectId, [...new Set(runIds)].sort()]);
}

export function createIntegrationDraft(
  releaseNumber: number,
  version: number | null = null,
): IntegrationDraft {
  return {
    title: `테스트 릴리스 ${releaseNumber}`,
    version,
    resolutions: {},
    chosenPaths: [],
    resolutionSource: "",
    transferPrompt: null,
    transferRaw: "",
  };
}

export function editIntegrationDraft(
  drafts: IntegrationDrafts,
  key: string,
  initial: IntegrationDraft,
  change: IntegrationDraftChange,
): IntegrationDrafts {
  const current = drafts[key] || initial;
  return {
    ...drafts,
    [key]: {
      ...current,
      ...(typeof change === "function" ? change(current) : change),
    },
  };
}

export function completeIntegrationDraft(
  drafts: IntegrationDrafts,
  key: string,
  submitted: IntegrationDraft,
): IntegrationDrafts {
  if (drafts[key] !== submitted) return drafts;
  const next = { ...drafts };
  delete next[key];
  return next;
}
