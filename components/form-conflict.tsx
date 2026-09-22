"use client";
import { useState } from "react";
import { compareFields, type FormValues } from "@/lib/teamvibe/form-conflicts";

export function FormConflict({
  fields,
  baseline,
  mine,
  latest,
  version,
  onPrepare,
}: {
  fields: {
    key: string;
    label: string;
    type?: string;
    options?: { value: string; label: string }[];
  }[];
  baseline: FormValues;
  mine: FormValues;
  latest: FormValues | null;
  version: number;
  onPrepare: (values: FormValues) => void;
}) {
  const [choices, setChoices] = useState<Record<string, "mine" | "latest">>({});
  if (!latest)
    return (
      <p className="helper-note">
        이 항목이 휴지통으로 이동했거나 프로젝트에 접근할 수 없습니다. 내 입력을
        복사한 뒤 닫고 현재 상태를 확인하세요.
      </p>
    );
  const comparisons = compareFields(baseline, mine, latest);
  const changed = comparisons.filter((field) => field.latest !== field.before);
  const unresolved = comparisons.filter(
    (field) => field.conflict && !choices[field.key],
  );
  const display = (key: string, value: string) => {
    const field = fields.find((f) => f.key === key);
    if (field?.type === "multiselect" && value)
      return value
        .split("\n")
        .filter(Boolean)
        .map(
          (id) =>
            field.options?.find((option) => option.value === id)?.label ||
            "이전 연결 항목",
        )
        .join("\n\n");
    return (
      field?.options?.find((o) => o.value === value)?.label ||
      value ||
      "(비어 있음)"
    );
  };
  return (
    <section className="conflict-review" aria-label="동시 편집 변경 비교">
      <h3>팀의 최신 변경과 내 입력을 비교하세요</h3>
      <p>
        서로 다른 필드의 변경은 함께 보존합니다. 같은 필드를 다르게 수정했다면
        사용할 내용을 선택하세요. 선택 후에도 저장 전 편집할 수 있습니다.
      </p>
      {changed.length === 0 && (
        <p>
          이 양식의 내용은 바뀌지 않았습니다. 프로젝트의 다른 변경을 유지하면서
          내 입력을 저장할 수 있습니다.
        </p>
      )}
      {changed.map((field) => (
        <div className="conflict-field" key={field.key}>
          <h4>
            {fields.find((f) => f.key === field.key)?.label || field.key}{" "}
            <span>{field.conflict ? "선택 필요" : "함께 반영"}</span>
          </h4>
          <details>
            <summary>편집을 시작할 때의 내용</summary>
            <pre>{display(field.key, field.before)}</pre>
          </details>
          <div className="conflict-values">
            <div>
              <strong>내 입력</strong>
              <pre>{display(field.key, field.mine)}</pre>
            </div>
            <div>
              <strong>팀의 최신 값</strong>
              <pre>{display(field.key, field.latest)}</pre>
            </div>
          </div>
          {field.conflict && (
            <div
              className="button-group"
              role="group"
              aria-label={`${fields.find((f) => f.key === field.key)?.label || field.key} 충돌 해결`}
            >
              <button
                type="button"
                className="button secondary"
                aria-pressed={choices[field.key] === "mine"}
                onClick={() => setChoices({ ...choices, [field.key]: "mine" })}
              >
                내 입력 사용
              </button>
              <button
                type="button"
                className="button secondary"
                aria-pressed={choices[field.key] === "latest"}
                onClick={() =>
                  setChoices({ ...choices, [field.key]: "latest" })
                }
              >
                팀의 최신 값 사용
              </button>
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        className="button primary"
        disabled={unresolved.length > 0}
        onClick={() =>
          onPrepare(
            Object.fromEntries(
              comparisons.map((field) => [
                field.key,
                field.conflict && choices[field.key] === "latest"
                  ? field.latest
                  : field.merged,
              ]),
            ),
          )
        }
      >
        변경을 합쳐 저장 준비
      </button>
      <small>
        {unresolved.length
          ? `${unresolved.length}개 필드의 내용을 선택해 주세요.`
          : `프로젝트 v${version} 기준으로 준비합니다. 다른 변경이 생기면 다시 비교합니다.`}
      </small>
    </section>
  );
}
