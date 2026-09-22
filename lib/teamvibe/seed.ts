import type { User, Project } from "./types";
import { createProject, draftPRD } from "./domain";
export const demoUsers: User[] = [
  { id: "jimin", name: "김지민", role: "제품 기획", color: "blue" },
  { id: "seoyeon", name: "이서연", role: "경영지원", color: "orange" },
  { id: "hyunwoo", name: "박현우", role: "개발", color: "purple" },
];
export function sampleProject(): Project {
  const p = createProject(
    "우리 팀의 비품 요청, 한곳에서.",
    "사내 비품 신청과 승인 과정을 더 간단하게 만드는 프로젝트",
    "신청 누락과 반복 문의를 줄이고, 직원이 비품 신청부터 처리 결과까지 직접 확인한다.",
    "jimin",
  );
  p.id = "demo-supplies";
  p.inviteCode = "TEAMVIBE2026";
  p.members = demoUsers.map((u) => u.id);
  p.createdAt = "2026-09-21T00:00:00.000Z";
  const examples = [
    [
      "seoyeon",
      "흩어진 비품 신청을 한곳에",
      "비품 신청이 메신저에 흩어져서 누가 뭘 요청했는지 놓쳐요. 신청 현황을 한눈에 보고 싶어요.",
    ],
    [
      "hyunwoo",
      "담당자의 승인 흐름",
      "승인 대기 건만 따로 볼 수 있으면 좋겠어요. 승인과 반려 사유도 남길 수 있게요.",
    ],
    [
      "jimin",
      "직원이 직접 확인하는 진행 상태",
      "직원들이 신청한 뒤 진행 상태를 직접 확인하면 반복 문의가 줄어들 것 같아요.",
    ],
  ];
  p.conversations = examples.map(([uid, title, content], i) => ({
    id: `conversation-${i + 1}`,
    createdAt: p.createdAt,
    title,
    ownerId: uid,
    messages: [
      {
        id: `message-${i + 1}`,
        createdAt: p.createdAt,
        authorId: uid,
        kind: "user",
        text: content,
      },
    ],
  }));
  p.requirements = [
    [
      "비품 신청 등록",
      "직원은 품목, 수량, 사용 목적을 입력하여 비품을 신청한다.",
      "accepted",
      "수량은 1 이상이며 품목과 목적은 필수다.",
    ],
    [
      "내 신청 목록과 상태 확인",
      "신청자는 자신의 신청 목록과 대기·승인·반려 상태를 확인한다.",
      "accepted",
      "신청 목록은 최근 신청 순서로 표시한다.",
    ],
    [
      "담당자의 승인과 반려",
      "담당자는 대기 신청을 승인하거나 사유와 함께 반려한다.",
      "conflict",
      "담당자 전체가 승인할지, 팀별 담당자만 승인할지 결정 필요.",
    ],
    [
      "신청 수정과 취소",
      "직원은 아직 처리되지 않은 신청을 수정하거나 취소한다.",
      "proposed",
      "승인 후 취소 가능 여부를 검토한다.",
    ],
    [
      "처리 이력 보관",
      "신청과 승인·반려·취소 이력을 시간순으로 확인한다.",
      "accepted",
      "누가 언제 무엇을 변경했는지 합성 사용자 이름으로 남긴다.",
    ],
  ].map(([title, description, status, decision], i) => ({
    id: `req-${i + 1}`,
    createdAt: p.createdAt,
    title,
    description,
    status: status as "accepted" | "conflict" | "proposed",
    decision,
    priority: "must",
    sourceIds: [`message-${(i % 3) + 1}`],
  }));
  p.prd.body = draftPRD(p);
  p.prd.revision = 1;
  p.events = [
    {
      id: "event-seed",
      at: p.createdAt,
      actorId: "jimin",
      action: "sample.created",
      detail: "합성 예시 프로젝트 · 실제 AI 수행/검증 이력 없음",
    },
  ];
  return p;
}
