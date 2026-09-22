export const MAX_RESULT_FILE_BYTES = 1_200_000;

export async function readJsonFile(file: {
  size: number;
  text: () => Promise<string>;
}): Promise<string> {
  if (file.size > MAX_RESULT_FILE_BYTES)
    throw new Error(
      "1.2 MB 이내의 JSON 파일을 선택하세요. 기존 입력은 유지됩니다.",
    );
  let value: string;
  try {
    value = await file.text();
  } catch {
    throw new Error(
      "파일을 읽지 못했습니다. 다른 파일을 선택하거나 JSON을 직접 붙여넣으세요. 기존 입력은 유지됩니다.",
    );
  }
  try {
    JSON.parse(value);
  } catch {
    throw new Error("올바른 JSON 파일이 아닙니다. 기존 입력은 유지됩니다.");
  }
  return value;
}

export function applyJsonFileValue<
  T extends { values: Record<string, string> },
>(current: T | null, started: T, key: string, value: string): T | null {
  // A closed/reopened form or a newer edit is a different snapshot, even when
  // its text is identical. Never revive or replace it with an older file read.
  if (current !== started) return current;
  return { ...current, values: { ...current.values, [key]: value } };
}
