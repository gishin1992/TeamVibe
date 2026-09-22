"use client";
import { useState } from "react";
import { ArrowRight, History, Link2 } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { Message, Project, Requirement, User } from "@/lib/teamvibe/types";
import { requirementSourcesChanged } from "@/lib/teamvibe/prd-review";

const date = (value: string) => new Date(value).toLocaleString("ko-KR");
const author = (users: User[], id: string) =>
  users.find((user) => user.id === id)?.name || id;

export function MessageHistory({
  message,
  users,
  canRestore,
  onRestore,
}: {
  message: Message;
  users: User[];
  canRestore: boolean;
  onRestore: (revision: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!message.history?.length) return null;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="text-button">
          <History size={14} />
          수정 이력 {message.history.length}개
        </button>
      </SheetTrigger>
      <SheetContent className="provenance-sheet">
        <SheetHeader>
          <SheetTitle>메시지 수정 이력</SheetTitle>
          <SheetDescription>
            이전 내용을 복원하면 새 버전으로 저장합니다. 현재 내용과 이력은
            보존됩니다.
          </SheetDescription>
        </SheetHeader>
        <div className="provenance-body">
          <article className="provenance-card">
            <h3>현재 내용 · v{message.revision || 1}</h3>
            <p>{message.text}</p>
            {message.source && <small>출처: {message.source}</small>}
            <small>
              {author(users, message.updatedBy || message.authorId)} ·{" "}
              {date(message.updatedAt || message.createdAt)}
            </small>
          </article>
          {message.history
            .slice()
            .reverse()
            .map((revision) => (
              <article className="provenance-card" key={revision.revision}>
                <h3>이전 내용 · v{revision.revision}</h3>
                <p>{revision.text}</p>
                {revision.source && <small>출처: {revision.source}</small>}
                <small>
                  {author(users, revision.authorId)} · {date(revision.at)}
                </small>
                {canRestore && (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setOpen(false);
                      onRestore(revision.revision);
                    }}
                  >
                    v{revision.revision} 내용 복원
                  </button>
                )}
              </article>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function RequirementSources({
  project,
  requirement,
  users,
  onOpenConversation,
}: {
  project: Project;
  requirement: Requirement;
  users: User[];
  onOpenConversation: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!requirement.sourceIds.length && !requirement.sourceHistory?.length)
    return <small className="source">직접 작성한 요구사항</small>;
  const sources = requirement.sourceIds.map((id) => {
    const conversation = project.conversations.find((c) =>
      c.messages.some((m) => m.id === id),
    );
    const message = conversation?.messages.find((m) => m.id === id);
    const recorded = requirement.sourceRevisions?.[id];
    const snapshot =
      message &&
      (recorded === (message.revision || 1)
        ? message
        : message.history?.find((version) => version.revision === recorded));
    return { id, conversation, message, recorded, snapshot };
  });
  const changed = requirementSourcesChanged(project, requirement);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="text-button source-trigger">
          <Link2 size={14} />
          {sources.length
            ? `대화 출처 ${sources.length}개 보기`
            : "이전 대화 출처 보기"}
          {changed && <span className="source-changed">수정된 출처</span>}
        </button>
      </SheetTrigger>
      <SheetContent className="provenance-sheet">
        <SheetHeader>
          <SheetTitle>요구사항의 대화 출처</SheetTitle>
          <SheetDescription>{requirement.title}</SheetDescription>
        </SheetHeader>
        <div className="provenance-body">
          {!sources.length && (
            <p>
              현재 연결한 대화 출처가 없습니다. 이전 연결은 아래 이력에
              보존됩니다.
            </p>
          )}
          {changed && (
            <p className="provenance-notice">
              연결한 뒤 수정된 메시지가 있습니다. 이전 내용과 현재 내용을
              비교하고 요구사항을 다시 합의해 주세요.
            </p>
          )}
          {sources.map(({ id, conversation, message, recorded, snapshot }) => (
            <article className="provenance-card" key={id}>
              <h3>{conversation?.title || "출처를 찾을 수 없습니다"}</h3>
              {message && (
                <>
                  <small>
                    {author(users, message.authorId)} ·{" "}
                    {message.kind === "chatgpt"
                      ? "ChatGPT 응답 수동 반입"
                      : message.kind === "guide"
                        ? "로컬 안내"
                        : "팀원 의견"}
                    {conversation?.deletedAt || message.deletedAt
                      ? " · 휴지통 보관"
                      : ""}
                  </small>
                  <h4>
                    {recorded === undefined
                      ? "현재 메시지 · 연결 시점 버전 미기록"
                      : `요구사항에 연결한 내용 · v${recorded}`}
                  </h4>
                  <p>
                    {snapshot?.text ||
                      (recorded === undefined
                        ? message.text
                        : "이 버전의 원문이 기록되지 않았습니다.")}
                  </p>
                  {(snapshot?.source ||
                    (recorded === undefined && message.source)) && (
                    <small>
                      응답 출처: {snapshot?.source || message.source}
                    </small>
                  )}
                  {recorded !== undefined &&
                    recorded !== (message.revision || 1) && (
                      <div className="latest-source">
                        <h4>현재 메시지 · v{message.revision || 1}</h4>
                        <p>{message.text}</p>
                        {message.source && (
                          <small>응답 출처: {message.source}</small>
                        )}
                      </div>
                    )}
                  {!conversation?.deletedAt && !message.deletedAt && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        setOpen(false);
                        onOpenConversation(conversation!.id);
                      }}
                    >
                      원문 대화 열기
                      <ArrowRight size={14} />
                    </button>
                  )}
                </>
              )}
            </article>
          ))}
          {!!requirement.sourceHistory?.length && (
            <details className="source-link-history">
              <summary>
                출처 연결 변경 이력 {requirement.sourceHistory.length}개
              </summary>
              <p className="muted-text">
                연결 교체·해제·버전 갱신 전의 기록입니다. 다시 연결하려면
                요구사항 편집에서 원문을 선택하세요. 휴지통 원문은 먼저 복원해야
                합니다.
              </p>
              {requirement.sourceHistory
                .slice()
                .reverse()
                .map((entry, index) => (
                  <section className="provenance-card" key={index}>
                    <h3>변경 전 연결 · {date(entry.at)}</h3>
                    <small>변경한 팀원: {author(users, entry.authorId)}</small>
                    {!entry.sourceIds.length && (
                      <p>대화 출처 없이 직접 작성한 상태</p>
                    )}
                    {entry.sourceIds.map((id) => {
                      const conversation = project.conversations.find((c) =>
                        c.messages.some((m) => m.id === id),
                      );
                      const message = conversation?.messages.find(
                        (m) => m.id === id,
                      );
                      const revision = entry.sourceRevisions[id];
                      const snapshot =
                        revision === (message?.revision || 1)
                          ? message
                          : message?.history?.find(
                              (item) => item.revision === revision,
                            );
                      return (
                        <div className="latest-source" key={id}>
                          <h4>
                            {conversation?.title || "원문 없음"} ·{" "}
                            {revision === undefined
                              ? "버전 미기록"
                              : `v${revision}`}
                          </h4>
                          {message && (
                            <small>
                              {author(users, message.authorId)}
                              {conversation?.deletedAt || message.deletedAt
                                ? " · 휴지통 보관"
                                : ""}
                            </small>
                          )}
                          <p>
                            {snapshot?.text ||
                              "당시 버전의 원문이 기록되지 않았습니다."}
                          </p>
                        </div>
                      );
                    })}
                  </section>
                ))}
            </details>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
