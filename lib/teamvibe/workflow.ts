import type { Project } from "./types";

export type WorkDestination =
  | { tab: "conversation" }
  | { tab: "prd"; section: "document" | "requirements" }
  | { tab: "stories"; section: "board" | "runs" }
  | { tab: "test"; section: "preview" | "results" | "feedback" };

// This is a navigation hint, not permission or evidence of completion.
// The caller supplies the same PRD agreement check used by the workspace.
export function nextProjectWork(
  p: Project,
  isAgreed: boolean,
): {
  step: number;
  title: string;
  body: string;
  label: string;
  destination: WorkDestination;
} {
  const requirements = p.requirements.filter((r) => !r.deletedAt);
  const stories = p.stories.filter((s) => !s.deletedAt);
  const runs = p.runs.filter((r) => !r.deletedAt);
  const active = p.releases.find((r) => !r.deletedAt && r.status === "active");
  if (!p.prd.body.trim() && !requirements.length)
    return {
      step: 0,
      title: "팀의 아이디어를 요구사항으로 정리하세요",
      body: "각자의 대화에서 필요한 기능과 예외를 찾고 공동 요구사항에 연결하세요.",
      label: "아이디어 대화 보기",
      destination: { tab: "conversation" },
    };
  if (!isAgreed) {
    const undecided = requirements.filter((r) => r.status !== "accepted");
    return {
      step: 1,
      title: "현재 요구사항과 PRD를 함께 검토하세요",
      body: undecided.length
        ? `아직 합의되지 않은 요구사항 ${undecided.length}개가 있습니다. 결정한 내용을 문서에 반영한 뒤 팀원 모두 동의해 주세요.`
        : "최신 요구사항이 문서에 반영되었는지 확인하고 각자의 프로필에서 현재 PRD에 동의해 주세요.",
      label: undecided.length ? "요구사항 검토하기" : "PRD 검토하기",
      destination: {
        tab: "prd",
        section: undecided.length ? "requirements" : "document",
      },
    };
  }
  const pending = runs.filter((r) =>
    ["running", "submitted"].includes(r.status),
  );
  const outdated = pending.filter(
    (r) =>
      r.prdRevision !== p.prd.revision ||
      (r.storyRevision || 1) !==
        (stories.find((s) => s.id === r.storyId)?.revision || 1),
  );
  if (outdated.length)
    return {
      step: 3,
      title: "이전 기준의 개발 작업을 다시 확인하세요",
      body: `${outdated.length}개 작업의 요구사항 또는 스토리가 바뀌었습니다. 기존 결과를 보존하고 작업을 취소한 뒤 최신 기준으로 다시 시작하세요.`,
      label: "개발 작업 검토하기",
      destination: { tab: "stories", section: "runs" },
    };
  const submitted = pending.filter((r) => r.status === "submitted");
  if (submitted.length)
    return {
      step: 3,
      title: "제출된 개발 결과를 비교하고 통합하세요",
      body: `${submitted.length}개 결과가 통합을 기다립니다. 같은 파일의 변경과 선행 작업의 검증 상태를 확인하세요.`,
      label: "통합할 결과 보기",
      destination: { tab: "stories", section: "runs" },
    };
  const running = pending.filter((r) => r.status === "running");
  if (running.length)
    return {
      step: 3,
      title: "ChatGPT에서 받은 개발 결과를 가져오세요",
      body: `${running.length}개 작업이 결과를 기다립니다. 작업 묶음을 직접 전달하고 받은 코드와 수행 로그를 반입하세요. 앱이 AI 작업을 자동 실행하지는 않습니다.`,
      label: "결과 대기 작업 보기",
      destination: { tab: "stories", section: "runs" },
    };
  if (active && stories.some((s) => s.status === "review"))
    return {
      step: 4,
      title: "통합 결과를 직접 사용하고 검증하세요",
      body: "현재 릴리스에서 각 스토리의 테스트 기준을 확인하고 실제 결과를 남겨 주세요. 실패한 부분은 피드백으로 연결할 수 있습니다.",
      label: "통합 화면 테스트하기",
      destination: { tab: "test", section: "preview" },
    };
  if (!stories.length || stories.some((s) => s.status !== "done"))
    return {
      step: 2,
      title: "작게 나눈 스토리를 개발할 준비를 하세요",
      body: "완료 조건·테스트 기준·선행 관계를 검토한 뒤 개발 준비로 바꾸세요. 독립적인 스토리는 함께 시작할 수 있습니다.",
      label: "스토리 설계하기",
      destination: { tab: "stories", section: "board" },
    };
  if (active && p.feedback.some((f) => !f.deletedAt && f.status === "open"))
    return {
      step: 4,
      title: "남은 팀 피드백을 검토하세요",
      body: "완료한 스토리의 검증 기록을 유지하며 새 피드백의 범위와 후속 개발 필요성을 함께 결정하세요.",
      label: "팀 피드백 보기",
      destination: { tab: "test", section: "feedback" },
    };
  return {
    step: 4,
    title: "완료한 스토리의 검증 결과를 확인하세요",
    body: "현재 릴리스와 실제 테스트 기록을 팀이 확인하고, 직접 사용해 본 피드백을 다음 작업으로 연결하세요.",
    label: "검증 결과 보기",
    destination: { tab: "test", section: "results" },
  };
}
