import type { Project, Requirement } from "./types";

// Only compare recorded versions; do not invent a baseline for legacy sources.
export function requirementSourcesChanged(
  project: Project,
  requirement: Requirement,
): boolean {
  return requirement.sourceIds.some((id) => {
    const recorded = requirement.sourceRevisions?.[id];
    if (recorded === undefined) return false;
    const message = project.conversations
      .flatMap((conversation) => conversation.messages)
      .find((item) => item.id === id);
    return !!message && recorded !== (message.revision || 1);
  });
}

export function prdApprovalBlockers(project: Project): string[] {
  const reasons: string[] = [];
  if (!project.prd.body.trim()) reasons.push("PRD를 먼저 작성하세요.");
  if ((project.prd.sourceRevision || 0) !== (project.requirementsVersion || 0))
    reasons.push(
      "요구사항 또는 프로젝트 목표가 변경되었습니다. PRD를 편집·저장하거나 초안을 다시 만든 후 동의하세요.",
    );
  const unresolved = project.requirements.filter(
    (item) =>
      !item.deletedAt &&
      (item.status !== "accepted" || requirementSourcesChanged(project, item)),
  );
  if (unresolved.length) {
    const names = unresolved
      .slice(0, 3)
      .map((item) => item.title)
      .join(", ");
    reasons.push(
      `모든 요구사항의 검토와 충돌 해결을 먼저 마쳐 주세요. 미해결: ${names}${unresolved.length > 3 ? ` 외 ${unresolved.length - 3}개` : ""}`,
    );
  }
  return reasons;
}
