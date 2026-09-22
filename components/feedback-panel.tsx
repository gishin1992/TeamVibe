"use client";
import { useState } from "react";
import { ArrowRight, Edit3, GitBranch, RotateCcw, Trash2 } from "lucide-react";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  alive,
  statusLabel,
  type Feedback,
  type Project,
  type Story,
  type User,
} from "@/lib/teamvibe/types";

export function FeedbackPanel({
  project,
  users,
  onEdit,
  onRemove,
  onCreateStory,
  onRestoreStory,
  onOpenStory,
}: {
  project: Project;
  users: User[];
  onEdit: (feedback: Feedback) => void;
  onRemove: (feedback: Feedback) => void;
  onCreateStory: (feedback: Feedback) => void;
  onRestoreStory: (story: Story) => void;
  onOpenStory: (story: Story) => void;
}) {
  const [scope, setScope] = useState("all");
  const active = alive(project.releases).find(
    (release) => release.status === "active",
  );
  const items = alive(project.feedback).filter(
    (feedback) =>
      scope === "all" ||
      (scope === "current"
        ? feedback.releaseId === active?.id
        : feedback.status === scope),
  );
  const releaseName = (id: string) =>
    project.releases.find((r) => r.id === id)?.title || "릴리스 정보 없음";
  const authorName = (id: string) =>
    users.find((user) => user.id === id)?.name || "이전 팀원";
  return (
    <>
      <div className="feedback-filter">
        <label htmlFor="feedback-scope">피드백 보기</label>
        <NativeSelect
          id="feedback-scope"
          value={scope}
          onChange={(event) => setScope(event.target.value)}
        >
          <NativeSelectOption value="all">
            모든 릴리스의 피드백
          </NativeSelectOption>
          <NativeSelectOption value="open">열린 피드백</NativeSelectOption>
          <NativeSelectOption value="resolved">
            해결된 피드백
          </NativeSelectOption>
          <NativeSelectOption value="current">
            현재 릴리스에서 발견
          </NativeSelectOption>
        </NativeSelect>
        <span>{items.length}개</span>
      </div>
      {items.map((feedback) => {
        const linked = project.stories.find(
          (story) => story.id === feedback.storyId,
        );
        const source = project.releases.find(
          (release) => release.id === feedback.releaseId,
        );
        const lastResolution = feedback.resolutionHistory?.at(-1);
        return (
          <article className="panel padded top-gap" key={feedback.id}>
            <div className="card-heading">
              <h3>{feedback.title}</h3>
              <span className={`tag tag-${feedback.status}`}>
                {statusLabel[feedback.status]}
              </span>
              <div className="push-right inline-actions">
                <button
                  className="icon-button"
                  aria-label={`${feedback.title} 피드백 수정`}
                  onClick={() => onEdit(feedback)}
                >
                  <Edit3 size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`${feedback.title} 피드백 삭제`}
                  onClick={() => onRemove(feedback)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p className="muted-text preserve">{feedback.body}</p>
            <p className="feedback-context">
              발견한 릴리스: {releaseName(feedback.releaseId)}
              {source?.deletedAt ? " · 휴지통에 보존됨" : ""}
              <br />
              작성: {authorName(feedback.authorId)}
              {feedback.updatedBy && feedback.updatedBy !== feedback.authorId
                ? ` · 최근 수정: ${authorName(feedback.updatedBy)}`
                : ""}
            </p>
            {linked ? (
              <div className="feedback-story-link">
                <strong>후속 스토리: {linked.title}</strong>
                <span>
                  {linked.deletedAt ? "휴지통" : statusLabel[linked.status]}
                </span>
                {linked.deletedAt ? (
                  <button
                    className="button secondary"
                    onClick={() => onRestoreStory(linked)}
                  >
                    <RotateCcw size={15} />
                    연결된 스토리 복원
                  </button>
                ) : (
                  <button
                    className="text-button"
                    onClick={() => onOpenStory(linked)}
                  >
                    <ArrowRight size={15} />
                    후속 스토리 보기·수정
                  </button>
                )}
                {!linked.deletedAt &&
                  (linked.title !== feedback.title ||
                    linked.description !== feedback.body) && (
                    <p>
                      피드백과 스토리의 내용이 다릅니다. 후속 스토리의 범위를
                      함께 검토하세요.
                    </p>
                  )}
              </div>
            ) : feedback.status === "open" ? (
              <button
                className="text-button"
                onClick={() => onCreateStory(feedback)}
              >
                <GitBranch size={15} />
                후속 스토리로 만들기
              </button>
            ) : (
              <p className="muted-text">
                추가 개발이 필요하면 피드백을 다시 열어 주세요.
              </p>
            )}
            {lastResolution && (
              <div className="feedback-resolution">
                <strong>
                  {feedback.status === "resolved"
                    ? "해결 확인 내용"
                    : "이전 해결 기록 · 현재 다시 열림"}
                </strong>
                <p>{lastResolution.note}</p>
                <small>
                  {lastResolution.releaseId
                    ? `확인한 릴리스: ${releaseName(lastResolution.releaseId)}`
                    : "별도 코드 검증 릴리스 지정 없음"}{" "}
                  · {authorName(lastResolution.authorId)}
                </small>
              </div>
            )}
            {(feedback.resolutionHistory?.length || 0) > 1 && (
              <details className="history-row">
                <summary>
                  전체 해결 이력 {feedback.resolutionHistory!.length}건
                </summary>
                {feedback
                  .resolutionHistory!.slice()
                  .reverse()
                  .map((entry, index) => (
                    <div className="feedback-resolution" key={index}>
                      <p>{entry.note}</p>
                      <small>
                        {new Date(entry.at).toLocaleString("ko-KR")} ·{" "}
                        {authorName(entry.authorId)} ·{" "}
                        {entry.releaseId
                          ? releaseName(entry.releaseId)
                          : "릴리스 지정 없음"}
                      </small>
                    </div>
                  ))}
              </details>
            )}
          </article>
        );
      })}
      {!items.length && (
        <div className="empty-state">
          <h3>이 조건에 해당하는 피드백이 없습니다</h3>
          <p>표시 범위를 바꾸거나 직접 사용해 본 내용을 남겨 주세요.</p>
        </div>
      )}
    </>
  );
}
