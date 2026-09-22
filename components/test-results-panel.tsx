"use client";
import { useState } from "react";
import { Edit3, Trash2 } from "lucide-react";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  alive,
  statusLabel,
  type Project,
  type TestResult,
  type User,
} from "@/lib/teamvibe/types";
import { RecordedCoverage, TestHistory } from "@/components/test-history";

export function TestResultsPanel({
  project,
  users,
  onEdit,
  onRemove,
}: {
  project: Project;
  users: User[];
  onEdit: (result: TestResult) => void;
  onRemove: (result: TestResult) => void;
}) {
  const [scope, setScope] = useState("all");
  const [status, setStatus] = useState("all");
  const active = alive(project.releases).find(
    (release) => release.status === "active",
  );
  const results = alive(project.testResults);
  const items = results
    .filter(
      (result) =>
        (scope === "all" ||
          result.releaseId === (scope === "current" ? active?.id : scope)) &&
        (status === "all" || result.status === status),
    )
    .slice()
    .reverse();
  const author = (id: string) =>
    users.find((user) => user.id === id)?.name || "이전 팀원";
  const time = (at: string) => new Date(at).toLocaleString("ko-KR");
  return (
    <>
      <div className="feedback-filter test-record-filter">
        <div className="test-filter-field">
          <label htmlFor="test-record-scope">검증 기록 보기</label>
          <NativeSelect
            id="test-record-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          >
            <NativeSelectOption value="all">모든 릴리스</NativeSelectOption>
            <NativeSelectOption value="current">현재 릴리스</NativeSelectOption>
            {project.releases
              .slice()
              .reverse()
              .map((release) => (
                <NativeSelectOption value={release.id} key={release.id}>
                  {release.title}
                  {release.deletedAt
                    ? " · 휴지통"
                    : release.id === active?.id
                      ? " · 현재"
                      : " · 이전"}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </div>
        <div className="test-filter-field">
          <label htmlFor="test-record-status">결과</label>
          <NativeSelect
            id="test-record-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <NativeSelectOption value="all">모든 결과</NativeSelectOption>
            {["passed", "failed", "blocked"].map((value) => (
              <NativeSelectOption key={value} value={value}>
                {statusLabel[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <span>
          {items.length}개 / 전체 {results.length}개
        </span>
      </div>
      <p className="muted-text">
        조회 범위를 바꿔도 실행 중인 릴리스는 바뀌지 않습니다. 완료 판단에는
        현재 릴리스와 스토리 버전이 일치하는 기록만 사용합니다.
      </p>
      {items.map((result) => {
        const release = project.releases.find(
          (item) => item.id === result.releaseId,
        );
        return (
          <article className="panel padded top-gap" key={result.id}>
            <div className="card-heading">
              <h3>{result.title}</h3>
              <span className={`tag tag-${result.status}`}>
                {statusLabel[result.status]}
              </span>
              <div className="push-right inline-actions">
                <button
                  className="icon-button"
                  aria-label={`${result.title} 테스트 수정`}
                  onClick={() => onEdit(result)}
                >
                  <Edit3 size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`${result.title} 테스트 삭제`}
                  onClick={() => onRemove(result)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p className="feedback-context">
              검증한 릴리스: {release?.title || "릴리스 정보 없음"} ·{" "}
              {release?.deletedAt
                ? "휴지통에 보존됨"
                : release?.id === active?.id
                  ? "현재 릴리스"
                  : "이전 릴리스"}
            </p>
            <dl className="test-details">
              <dt>수행 절차</dt>
              <dd>{result.steps}</dd>
              <dt>기대 결과</dt>
              <dd>{result.expected}</dd>
              <dt>실제 결과</dt>
              <dd>{result.actual}</dd>
            </dl>
            <small className="source">
              기록자 {author(result.authorId)} · {time(result.createdAt)} ·{" "}
              {result.kind === "browser" ? "브라우저 확인 기록" : "수동 기록"}
              {result.updatedBy &&
                ` · 최근 수정 ${author(result.updatedBy)} · ${time(result.updatedAt!)}`}
              {` · v${result.revision || 1} · 테스트 기준 ${result.coverage?.length || 0}개 연결`}
            </small>
            <RecordedCoverage result={result} />
            <TestHistory result={result} project={project} users={users} />
          </article>
        );
      })}
      {!items.length && (
        <div className="panel padded top-gap">
          <h3>
            {results.length
              ? "선택한 조건에 맞는 기록이 없어요"
              : "아직 검증 기록이 없어요"}
          </h3>
          <p className="muted-text">
            {results.length
              ? "조회 범위나 결과를 바꿔 다른 기록을 확인하세요."
              : "현재 릴리스를 직접 사용한 결과와 실패·진행 불가 사항을 남겨 주세요."}
          </p>
        </div>
      )}
    </>
  );
}
