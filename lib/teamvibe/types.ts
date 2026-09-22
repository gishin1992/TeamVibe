export type User = {
  id: string;
  name: string;
  role: string;
  color: string;
  archived?: number;
};
export type Base = { id: string; createdAt: string; deletedAt?: string };
export type MessageRevision = {
  revision: number;
  text: string;
  source?: string;
  at: string;
  authorId: string;
};
export type Message = Base & {
  revision?: number;
  updatedAt?: string;
  updatedBy?: string;
  history?: MessageRevision[];
  authorId: string;
  kind: "user" | "chatgpt" | "guide";
  text: string;
  source?: string;
};
export type Conversation = Base & {
  title: string;
  ownerId: string;
  messages: Message[];
};
export type RequirementValues = {
  title: string;
  description: string;
  priority: "must" | "should" | "could";
  status: "proposed" | "accepted" | "conflict";
  sourceIds: string[];
  sourceRevisions?: Record<string, number>;
  decision: string;
};
export type RequirementChange =
  | "created"
  | "imported"
  | "edited"
  | "merged"
  | "source-updated"
  | "restored-for-review";
export type RequirementRevision = RequirementValues & {
  revision: number;
  at: string;
  authorId?: string;
  change?: RequirementChange;
};
export type Requirement = Base &
  RequirementValues & {
    authorId?: string;
    revision?: number;
    updatedAt?: string;
    updatedBy?: string;
    change?: RequirementChange;
    history?: RequirementRevision[];
    sourceHistory?: {
      sourceIds: string[];
      sourceRevisions: Record<string, number>;
      at: string;
      authorId: string;
    }[];
    extractionSource?: {
      batchId: string;
      key: string;
      source: string;
      reviewNote: string;
    };
  };
export type PRDChange = "edited" | "generated" | "restored";
export type PRDVersion = {
  body: string;
  revision: number;
  sourceRevision?: number;
  updatedAt?: string;
  updatedBy?: string;
  change?: PRDChange;
  restoredFromRevision?: number;
};
export type PRDRevision = PRDVersion & {
  // Existing fields describe archival, not authorship of the archived body.
  at: string;
  authorId: string;
};
export type PRD = PRDVersion & {
  approvals: string[];
  history: PRDRevision[];
};
export type Story = Base & {
  assignmentHistory?: {
    from: string;
    to: string;
    at: string;
    authorId: string;
    reason: "assigned" | "member-removed" | "member-left" | "restored";
  }[];
  planningSource?: { planId: string; key: string; source: string };
  revision?: number;
  title: string;
  description: string;
  acceptance: string[];
  tests: string[];
  dependencies: string[];
  requirementIds: string[];
  ownerId: string;
  status: "backlog" | "ready" | "developing" | "review" | "done";
  prdRevision: number;
};
export type RunResultValues = {
  files: Record<string, string>;
  // Omission preserves a file. Exclusions apply only to a new integrated release.
  deletedFiles?: string[];
  log: string;
  source: string;
};
export type RunSubmissionRevision = RunResultValues & {
  revision: number;
  at?: string;
  authorId?: string;
};
export type Run = Base &
  RunResultValues & {
    submissionRevision?: number;
    submittedAt?: string;
    submittedBy?: string;
    submissionHistory?: RunSubmissionRevision[];
    resultContextRequired?: boolean;
    // Empty means no release existed; undefined denotes legacy, unknown baseline.
    baseReleaseId?: string;
    storyRevision?: number;
    storyId: string;
    title: string;
    status: "running" | "submitted" | "integrated" | "cancelled";
    prompt: string;
    prdRevision: number;
  };
export type Release = Base & {
  deletedFiles?: string[];
  resolutionSource?: string;
  baseReleaseId?: string;
  resolutions?: {
    path: string;
    reason: string;
    runIds: string[];
    actorId: string;
    action?: "write" | "delete";
  }[];
  title: string;
  runIds: string[];
  files: Record<string, string>;
  status: "active" | "superseded";
};
export type TestCoverageSnapshot = {
  key: string;
  storyId: string;
  storyRevision: number;
  prdRevision: number;
  storyTitle: string;
  criterion: string;
};
export type TestResultValues = {
  releaseId: string;
  coverage?: string[];
  coverageSnapshots?: TestCoverageSnapshot[];
  title: string;
  steps: string;
  expected: string;
  actual: string;
  status: "passed" | "failed" | "blocked";
  kind: "manual" | "browser";
};
export type TestResultRevision = TestResultValues & {
  revision: number;
  at: string;
  authorId: string;
};
export type TestResult = Base &
  TestResultValues & {
    authorId: string;
    revision?: number;
    updatedAt?: string;
    updatedBy?: string;
    history?: TestResultRevision[];
  };
export type Feedback = Base & {
  updatedAt?: string;
  updatedBy?: string;
  resolutionHistory?: {
    note: string;
    releaseId: string;
    at: string;
    authorId: string;
  }[];
  releaseId: string;
  title: string;
  body: string;
  status: "open" | "resolved";
  authorId: string;
  storyId?: string;
};
export type Event = {
  id: string;
  at: string;
  actorId: string;
  action: string;
  detail: string;
};
export type Project = Base & {
  name: string;
  description: string;
  goal: string;
  inviteCode: string;
  ownerId: string;
  members: string[];
  version: number;
  conversations: Conversation[];
  requirements: Requirement[];
  requirementsVersion?: number;
  requirementImports?: {
    id: string;
    source: string;
    at: string;
    requirementIds: string[];
  }[];
  prd: PRD;
  stories: Story[];
  storyPlanImports?: {
    id: string;
    source: string;
    prdRevision: number;
    at: string;
    storyIds: string[];
  }[];
  runs: Run[];
  releases: Release[];
  testResults: TestResult[];
  feedback: Feedback[];
  events: Event[];
  updatedAt: string;
};
export type Operation = { type: string; [key: string]: unknown };
export const alive = <T extends { deletedAt?: string }>(items: T[]) =>
  items.filter((x) => !x.deletedAt);
export const statusLabel: Record<string, string> = {
  backlog: "백로그",
  ready: "개발 준비",
  developing: "개발 중",
  review: "검토 대기",
  done: "완료",
  running: "개발 진행",
  submitted: "결과 제출",
  integrated: "통합 완료",
  cancelled: "취소",
  proposed: "검토 대기",
  accepted: "합의됨",
  conflict: "의견 충돌",
  must: "필수",
  should: "권장",
  could: "선택",
  passed: "통과",
  failed: "실패",
  blocked: "진행 불가",
  open: "열림",
  resolved: "해결됨",
};
export const collectionLabel: Record<string, string> = {
  conversations: "대화",
  requirements: "요구사항",
  stories: "사용자 스토리",
  runs: "개발 작업",
  releases: "릴리스",
  testResults: "검증 기록",
  feedback: "피드백",
};
export const activityLabel: Record<string, string> = {
  "project.create": "프로젝트 생성",
  "project.edit": "프로젝트 정보 수정",
  "project.delete": "프로젝트 휴지통 이동",
  "project.restore": "프로젝트 복원",
  "member.join": "팀 참여",
  "member.remove": "멤버 제외",
  "member.leave": "팀 나가기",
  "owner.transfer": "오너 권한 이전",
  "invite.rotate": "초대 코드 재발급",
  "conversation.save": "대화 저장",
  "message.save": "메시지 저장",
  "message.delete": "메시지 휴지통 이동",
  "message.restore": "메시지 복원",
  "message.revert": "메시지 이전 내용 복원",
  "requirement.save": "요구사항 저장",
  "requirement.merge": "요구사항 통합",
  "requirement.import": "ChatGPT 요구사항 제안 반입",
  "prd.generate": "PRD 초안 생성",
  "prd.save": "PRD 저장",
  "prd.restore": "PRD 이전 본문 복원",
  "prd.approve": "PRD 동의",
  "prd.unapprove": "PRD 동의 철회",
  "story.save": "스토리 저장",
  "story.assign": "스토리 담당자 변경",
  "story.generate": "스토리 분할 초안 생성",
  "story.import": "ChatGPT 스토리 설계 반입",
  "story.complete": "스토리 완료",
  "run.start": "개발 작업 시작",
  "run.submit": "개발 결과 반입",
  "run.cancel": "개발 작업 취소",
  "release.create": "개발 결과 통합",
  "release.activate": "릴리스 활성화",
  "release.rename": "릴리스 이름 수정",
  "test.save": "검증 기록 저장",
  "feedback.save": "피드백 저장",
  "feedback.story": "피드백을 후속 스토리로 전환",
  "item.delete": "항목 휴지통 이동",
  "item.restore": "항목 복원",
};
