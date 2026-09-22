"use client";
import { History } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  statusLabel,
  type Requirement,
  type RequirementRevision,
  type User,
} from "@/lib/teamvibe/types";
import {
  requirementValues,
  requirementChangeLabel,
} from "@/lib/teamvibe/requirement-history";

export function RequirementHistory({
  requirement,
  users,
}: {
  requirement: Requirement;
  users: User[];
}) {
  const name = (id?: string) =>
    id
      ? users.find((user) => user.id === id)?.name || "이전 사용자"
      : "작성자 미기록";
  const revisions: RequirementRevision[] = [
    {
      ...requirementValues(requirement),
      revision: requirement.revision || 1,
      at: requirement.updatedAt || requirement.createdAt,
      authorId: requirement.updatedBy || requirement.authorId,
      change: requirement.change,
    },
    ...(requirement.history || []).slice().reverse(),
  ];
  return (
    <div className="requirement-history">
      <small>
        최초 {name(requirement.authorId)}
        {requirement.updatedBy && ` · 최근 ${name(requirement.updatedBy)}`} ·
        기록 v{requirement.revision || 1}
      </small>
      {!!requirement.history?.length && (
        <Sheet>
          <SheetTrigger asChild>
            <button className="text-button">
              <History size={14} />
              요구사항 수정 이력 {requirement.history.length}개
            </button>
          </SheetTrigger>
          <SheetContent className="provenance-sheet">
            <SheetHeader>
              <SheetTitle>요구사항 수정 이력</SheetTitle>
              <SheetDescription>{requirement.title}</SheetDescription>
            </SheetHeader>
            <div className="provenance-body">
              <p className="provenance-notice">
                제목·내용·결정 근거와 검토 상태를 보존한 기록입니다. 이전 합의는
                현재의 동의를 대신하지 않습니다. 버전은 보존 시작 시점부터
                표시하며, 도입 전 변경과 작성자를 소급해서 만들지 않습니다.
              </p>
              {revisions.map((revision, index) => (
                <article className="provenance-card" key={revision.revision}>
                  <h3>
                    {index === 0 ? "현재 기록" : "이전 기록"} · v
                    {revision.revision} · {statusLabel[revision.status]}
                  </h3>
                  <h4>{revision.title}</h4>
                  <small>
                    {name(revision.authorId)} ·{" "}
                    {new Date(revision.at).toLocaleString("ko-KR")}
                  </small>
                  <small>
                    {revision.change
                      ? requirementChangeLabel[revision.change]
                      : "변경 경위 미기록"}{" "}
                    · {statusLabel[revision.priority]} · 당시 대화 출처{" "}
                    {revision.sourceIds.length}개
                  </small>
                  <dl className="test-details">
                    <dt>요구사항 내용</dt>
                    <dd>{revision.description}</dd>
                    <dt>결정 근거</dt>
                    <dd>{revision.decision || "기록 없음"}</dd>
                  </dl>
                </article>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
