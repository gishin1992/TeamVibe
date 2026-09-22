"use client";
import { History } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Run, User } from "@/lib/teamvibe/types";
import { runSubmissionSnapshot } from "@/lib/teamvibe/run-submissions";
import { runResultContext } from "@/lib/teamvibe/run-result";

export function RunResultHistory({
  projectId,
  run,
  users,
}: {
  projectId: string;
  run: Run;
  users: User[];
}) {
  if (!run.log) return null;
  const name = (id?: string) =>
    id
      ? users.find((user) => user.id === id)?.name || "이전 사용자"
      : "반입자 미기록";
  const date = (at?: string) =>
    at ? new Date(at).toLocaleString("ko-KR") : "반입 시각 미기록";
  const current = runSubmissionSnapshot(run);
  const versions = [
    current,
    ...(run.submissionHistory || []).slice().reverse(),
  ];
  return (
    <div className="run-result-history">
      <p className="muted-text">
        결과 v{current.revision} · 반입: {name(current.authorId)} ·{" "}
        {date(current.at)}
      </p>
      {!!run.submissionHistory?.length && (
        <Sheet>
          <SheetTrigger asChild>
            <button className="text-button">
              <History size={14} />
              결과 수정 이력 {run.submissionHistory.length}개
            </button>
          </SheetTrigger>
          <SheetContent className="provenance-sheet">
            <SheetHeader>
              <SheetTitle>개발 결과 수정 이력</SheetTitle>
              <SheetDescription>{run.title}</SheetDescription>
            </SheetHeader>
            <div className="provenance-body">
              <p className="provenance-notice">
                이전 코드·제외 요청·로그·출처는 읽기 전용으로 보존됩니다.
                반입자는 결과를 저장한 팀원이며 코드 작성자나 실행 검증자를
                뜻하지 않습니다. 이전 결과로 되돌리려면 해당 JSON을 복사해 같은
                작업의 ‘제출 결과 수정’에서 다시 반입하세요. 통합·취소한 작업은
                수정할 수 없습니다.
              </p>
              {versions.map((version, index) => (
                <article className="provenance-card" key={version.revision}>
                  <h3>
                    {index === 0 ? "현재 결과" : "이전 결과"} · v
                    {version.revision}
                  </h3>
                  <small>
                    반입: {name(version.authorId)} · {date(version.at)}
                  </small>
                  <p>출처: {version.source}</p>
                  <pre className="code-block">{version.log}</pre>
                  <p>
                    추가·수정 파일:{" "}
                    {Object.keys(version.files).join(", ") || "없음"}
                  </p>
                  <p>제외 요청: {version.deletedFiles?.join(", ") || "없음"}</p>
                  <details>
                    <summary>v{version.revision} 결과 JSON 보기</summary>
                    <textarea
                      className="run-result-json"
                      aria-label={`결과 v${version.revision} JSON`}
                      readOnly
                      rows={10}
                      value={JSON.stringify(
                        {
                          context: runResultContext(projectId, run),
                          files: version.files,
                          deletedFiles: version.deletedFiles || [],
                          log: version.log,
                          source: version.source,
                        },
                        null,
                        2,
                      )}
                    />
                    <p className="muted-text">
                      같은 개발 작업의 반입 형식입니다. 다른 작업에는 해당
                      작업의 요청을 사용하세요. 도입 전 변경 이력이나 반입자를
                      소급해서 만들지 않습니다.
                    </p>
                  </details>
                </article>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
