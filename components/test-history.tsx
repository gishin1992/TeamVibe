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
  type Project,
  type TestResult,
  type TestResultRevision,
  type TestResultValues,
  type User,
} from "@/lib/teamvibe/types";
import { testResultValues } from "@/lib/teamvibe/test-history";
import { recordedCoverageLabel } from "@/lib/teamvibe/test-coverage";

export function RecordedCoverage({ result }: { result: TestResultValues }) {
  if (!result.coverage?.length) return null;
  return (
    <details className="history-row">
      <summary>검증 당시 테스트 기준 {result.coverage.length}개</summary>
      <ul className="recorded-coverage">
        {result.coverage.map((key) => (
          <li key={key}>{recordedCoverageLabel(result, key)}</li>
        ))}
      </ul>
    </details>
  );
}

export function TestHistory({
  result,
  project,
  users,
}: {
  result: TestResult;
  project: Project;
  users: User[];
}) {
  if (!result.history?.length) return null;
  const revisions: TestResultRevision[] = [
    {
      ...testResultValues(result),
      revision: result.revision || 1,
      at: result.updatedAt || result.createdAt,
      authorId: result.updatedBy || result.authorId,
    },
    ...result.history.slice().reverse(),
  ];
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="text-button">
          <History size={14} />
          검증 기록 수정 이력 {result.history.length}개
        </button>
      </SheetTrigger>
      <SheetContent className="provenance-sheet">
        <SheetHeader>
          <SheetTitle>검증 기록 수정 이력</SheetTitle>
          <SheetDescription>{result.title}</SheetDescription>
        </SheetHeader>
        <div className="provenance-body">
          <p className="provenance-notice">
            이전 기록은 변경 경위를 보여줍니다. 완료 판단에는 현재 기록만
            사용하며, 이력을 열어 보는 것은 테스트를 다시 실행하는 것이
            아닙니다.
          </p>
          {revisions.map((revision, index) => (
            <article className="provenance-card" key={revision.revision}>
              <h3>
                {index === 0 ? "현재 기록" : "이전 기록"} · v{revision.revision}{" "}
                · {statusLabel[revision.status]}
              </h3>
              <h4>{revision.title}</h4>
              <small>
                {users.find((user) => user.id === revision.authorId)?.name ||
                  "이전 사용자"}{" "}
                · {new Date(revision.at).toLocaleString("ko-KR")}
              </small>
              <small>
                검증 릴리스:{" "}
                {project.releases.find(
                  (release) => release.id === revision.releaseId,
                )?.title || "이전 릴리스"}{" "}
                · 연결한 테스트 기준 {revision.coverage?.length || 0}개
              </small>
              <small>
                {revision.kind === "browser"
                  ? "브라우저 확인 기록"
                  : "수동 기록"}
              </small>
              <dl className="test-details">
                <dt>수행 절차</dt>
                <dd>{revision.steps}</dd>
                <dt>기대 결과</dt>
                <dd>{revision.expected}</dd>
                <dt>실제 결과</dt>
                <dd>{revision.actual}</dd>
              </dl>
              <RecordedCoverage result={revision} />
            </article>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
