import type {
  Requirement,
  RequirementChange,
  RequirementValues,
} from "./types";

export function requirementValues(requirement: Requirement): RequirementValues {
  return {
    title: requirement.title,
    description: requirement.description,
    priority: requirement.priority,
    status: requirement.status,
    decision: requirement.decision,
    sourceIds: [...requirement.sourceIds],
    sourceRevisions: { ...requirement.sourceRevisions },
  };
}

export function rememberRequirement(
  requirement: Requirement,
  actorId: string,
  change: RequirementChange,
) {
  requirement.history ??= [];
  requirement.history.push({
    ...requirementValues(requirement),
    revision: requirement.revision || 1,
    at: requirement.updatedAt || requirement.createdAt,
    authorId: requirement.updatedBy || requirement.authorId,
    change: requirement.change,
  });
  requirement.revision = (requirement.revision || 1) + 1;
  requirement.updatedAt = new Date().toISOString();
  requirement.updatedBy = actorId;
  requirement.change = change;
}

export const requirementChangeLabel: Record<RequirementChange, string> = {
  created: "직접 등록",
  imported: "요구사항 제안 반입",
  edited: "요구사항 편집",
  merged: "요구사항 통합",
  "source-updated": "원문 변경으로 재검토",
  "restored-for-review": "복원 시 원문 변경 확인",
};
