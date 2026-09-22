"use client";
import { RotateCcw } from "lucide-react";
import type { PRD, PRDChange, PRDVersion, User } from "@/lib/teamvibe/types";

const changes: Record<PRDChange, string> = {
  edited: "직접 편집",
  generated: "요구사항 기반 규칙 초안",
  restored: "이전 본문 복원",
};
const date = (value: string) => new Date(value).toLocaleString("ko-KR");
const name = (users: User[], id?: string) =>
  id
    ? users.find((user) => user.id === id)?.name || "이전 사용자"
    : "작성자 미기록";

function VersionMetadata({
  version,
  users,
}: {
  version: PRDVersion;
  users: User[];
}) {
  return (
    <div className="prd-version-metadata">
      <p>
        작성: {name(users, version.updatedBy)} ·{" "}
        {version.updatedAt ? date(version.updatedAt) : "작성 시각 미기록"}
      </p>
      <p>
        {version.change ? changes[version.change] : "작성 경위 미기록"}
        {version.restoredFromRevision !== undefined &&
          ` · v${version.restoredFromRevision} 본문에서 복원`}
        {" · "}
        {version.sourceRevision !== undefined
          ? `요구사항 반영 기준 v${version.sourceRevision}`
          : "요구사항 반영 기준 미기록"}
      </p>
    </div>
  );
}

export function PrdHistory({
  prd,
  users,
  onRestore,
}: {
  prd: PRD;
  users: User[];
  onRestore: (revision: number) => void;
}) {
  return (
    <section className="panel padded">
      <h2>PRD 버전 기록</h2>
      <p className="muted-text">
        작성은 해당 본문을 저장한 사람, 보관은 다음 버전을 만든 사람입니다. 과거
        본문을 복원하면 현재 요구사항과 비교한 뒤 팀원들이 다시 동의해야 합니다.
        도입 전 작성 정보는 소급해서 만들지 않습니다.
      </p>
      <article className="prd-current-version">
        <h3>현재 문서 · v{prd.revision}</h3>
        <VersionMetadata version={prd} users={users} />
      </article>
      {prd.history
        .slice()
        .reverse()
        .map((entry) => (
          <details className="history-row" key={entry.revision}>
            <summary>
              이전 문서 · v{entry.revision} · {name(users, entry.updatedBy)}
            </summary>
            <VersionMetadata version={entry} users={users} />
            <p className="muted-text">
              보관: {name(users, entry.authorId)} · {date(entry.at)}
            </p>
            <pre className="markdown-document">{entry.body || "(빈 문서)"}</pre>
            {entry.body.trim() ? (
              <button
                className="button secondary"
                onClick={() => onRestore(entry.revision)}
              >
                <RotateCcw size={15} />v{entry.revision} 본문으로 새 버전 만들기
              </button>
            ) : (
              <p className="muted-text">
                작성 전 빈 문서는 복원할 수 없습니다.
              </p>
            )}
          </details>
        ))}
      {!prd.history.length && (
        <p className="muted-text">
          이후 편집부터 이전 버전이 여기에 보관됩니다.
        </p>
      )}
    </section>
  );
}
