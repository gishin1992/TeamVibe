import { fixtureResultData } from "../scripts/result-context.mjs";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
const base = process.env.TEAMVIBE_URL || "http://localhost:5174";
const results = [];
let count = 0;
const record = (name) => {
  results.push({ name, status: "passed", at: new Date().toISOString() });
  console.log(`PASS ${++count}: ${name}`);
};
async function client(uid) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: uid }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie").split(";")[0];
  return async (path, body, status = 200) => {
    const r = await fetch(base + "/api/" + path, {
      headers: {
        Cookie: cookie,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    });
    const data = await r.json();
    assert.equal(r.status, status, `${path}: ${JSON.stringify(data)}`);
    return data;
  };
}
try {
  const a = await client("jimin"),
    b = await client("seoyeon"),
    c = await client("hyunwoo");
  let p = await a(
    "projects",
    {
      name: "검증 · 협업 비품 앱 " + Date.now(),
      description: "합성 데이터만 사용하는 독립 검증 프로젝트",
      goal: "팀이 합의하고 병렬 개발 결과를 통합해 검증한다.",
    },
    201,
  );
  record("프로젝트 생성 및 독립 사용자 세션");
  const projectId = p.id;
  const op = async (type, data = {}, which = a, status = 200) => {
    const next = await which(
      "projects/" + p.id,
      { type, version: p.version, ...fixtureResultData(p, type, data) },
      status,
    );
    if (status === 200) p = next;
    return next;
  };
  await b("projects/" + p.id, undefined, 403);
  await b("join", { code: "not-valid" }, 404);
  await b("join", { code: p.inviteCode });
  p = await c("join", { code: p.inviteCode });
  record("초대 참여, 잘못된 초대 코드와 비멤버 접근 차단");
  await op("conversation.save", { title: "직원 신청 경험" });
  let conversation = p.conversations.at(-1);
  await op("message.save", {
    conversationId: conversation.id,
    text: "비품 이름과 수량을 적어 신청하고 취소하고 싶어요.",
    kind: "user",
  });
  await op(
    "message.save",
    {
      conversationId: conversation.id,
      text: "다른 사람 대화 변경 시도",
      kind: "user",
    },
    b,
    403,
  );
  await op("message.save", {
    conversationId: conversation.id,
    text: "완료 조건에 입력 검증과 취소를 포함하세요.",
    kind: "chatgpt",
    source: "API 통합 검증용 합성 응답 — 실제 ChatGPT 응답 아님",
  });
  record("대화 저장, 로컬 안내, 응답 반입, 대화 소유권 검사");
  for (const [title, description] of [
    ["신청 화면", "직원이 품목과 수량을 입력해 신청한다."],
    ["화면 스타일", "목록과 입력 필드가 모바일에서도 읽기 좋게 표시된다."],
  ])
    await op("requirement.save", {
      title,
      description,
      priority: "must",
      status: "accepted",
      decision: "팀이 합성 환경의 정상·오류·삭제 흐름을 검토하기로 합의.",
      sourceIds: [],
    });
  await op("prd.generate");
  await op("prd.approve");
  await op("story.generate", {}, a, 400);
  await op("prd.approve", {}, b);
  await op("prd.approve", {}, c);
  await op("story.generate");
  assert.equal(p.stories.length, 2);
  record("요구사항 합의 → PRD 초안 → 전원 동의 → 스토리 분할");
  for (const s of p.stories.slice())
    await op("story.save", { ...s, status: "ready" });
  const oldVersion = p.version;
  await op("project.edit", {
    name: p.name,
    description: p.description,
    goal: p.goal,
  });
  await a(
    "projects/" + p.id,
    {
      type: "project.edit",
      version: oldVersion,
      name: "덮어쓰기",
      description: "",
      goal: "충돌",
    },
    409,
  );
  record("오래된 버전 저장 시 409 반환, 덮어쓰기 차단");
  await op("run.start", { storyIds: p.stories.map((s) => s.id) });
  assert.equal(p.runs.filter((r) => r.status === "running").length, 2);
  assert.ok(p.runs.every((r) => r.prompt.includes("완료 조건")));
  record("독립 스토리 2개 동시 시작 및 개별 ChatGPT 작업 묶음");
  const runIds = p.runs.map((r) => r.id);
  await op(
    "run.submit",
    {
      id: runIds[0],
      files: { "../secret.js": "x" },
      log: "test",
      source: "test",
    },
    a,
    400,
  );
  const html =
    '<!doctype html><html lang="ko"><head><title>팀 비품 신청</title><link rel="stylesheet" href="styles.css"></head><body><main><h1>팀 비품 신청</h1><p>합성 테스트 시스템</p><form id="request-form"><label>품목<input id="item" required></label><label>수량<input id="quantity" type="number" min="1" value="1" required></label><button type="submit">신청하기</button></form><p id="status" role="status"></p><ul id="requests"></ul></main><script src="app.js"></script></body></html>';
  const js = `const form=document.querySelector('#request-form');const requests=document.querySelector('#requests');form.addEventListener('submit',e=>{e.preventDefault();const item=document.querySelector('#item');const qty=document.querySelector('#quantity');if(!item.value.trim()||Number(qty.value)<1)return;const li=document.createElement('li');const label=document.createElement('span');label.textContent=item.value+' · '+qty.value+'개 · 승인 대기';li.append(label);const edit=document.createElement('button');edit.textContent='수정';edit.addEventListener('click',()=>{item.value=label.textContent.split(' · ')[0];li.remove();document.querySelector('#status').textContent='수정 후 다시 신청해 주세요.'});li.append(edit);const remove=document.createElement('button');remove.textContent='취소';remove.addEventListener('click',()=>{li.remove();document.querySelector('#status').textContent='신청을 취소했습니다.'});li.append(remove);requests.prepend(li);document.querySelector('#status').textContent='신청을 등록했습니다.';form.reset()});`;
  const css =
    "*{box-sizing:border-box}body{margin:0;background:#f4f7fc;color:#25334e;font:16px/1.7 Arial,sans-serif}main{max-width:760px;margin:55px auto;padding:30px}h1{font-size:30px}p{color:#7d8ca4}form{display:flex;gap:15px;flex-wrap:wrap;padding:25px;background:white;border:1px solid #e0e7f2;border-radius:12px}label{display:flex;flex-direction:column;font-size:14px;gap:7px;flex:1}input{font:inherit;padding:10px;border:1px solid #dce3ee;border-radius:7px;min-width:120px;width:100%}button{font:inherit;padding:9px 15px;border:0;border-radius:7px;background:#365cec;color:white;cursor:pointer;align-self:end}li{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:18px;background:white;border-radius:8px;margin:12px 0}li span{flex:1}ul{list-style:none;padding:0}li button{font-size:13px;background:#edf2ff;color:#506ec6}";
  await op("run.submit", {
    id: runIds[0],
    files: { "index.html": html, "app.js": js },
    log: "합성 앱 HTML/JS 작성. 이 시점에는 브라우저 동작 검증 전.",
    source: "Codex의 실제 로컬 API 통합 검증 세션",
  });
  await op("run.submit", {
    id: runIds[1],
    files: { "index.html": "충돌 파일", "styles.css": css },
    log: "파일 충돌 처리 확인용",
    source: "합성 충돌 테스트",
  });
  await op("release.create", { runIds, title: "충돌 릴리스" }, a, 400);
  await op("run.submit", {
    id: runIds[1],
    files: { "styles.css": css },
    log: "반응형 스타일 작성. 이 시점에는 브라우저 검증 전.",
    source: "Codex의 실제 로컬 API 통합 검증 세션",
  });
  await op("release.create", { runIds, title: "시연 릴리스 v1" });
  record("결과 반입, 경로 검증, 서로 다른 결과의 파일 충돌 차단과 통합");
  await op("story.complete", { id: p.stories[0].id }, a, 400);
  record("실제 검증 기록 전 완료 처리 차단");
  await op("feedback.save", {
    releaseId: p.releases.at(-1).id,
    title: "신청 상태 필터 추가 검토",
    body: "대기 중인 신청만 모아 보는 필터를 추가한다.",
    status: "open",
  });
  const f = p.feedback.at(-1);
  await op("feedback.story", { id: f.id });
  assert.equal(p.stories.at(-1).title, f.title);
  await op("item.delete", { collection: "feedback", id: f.id });
  assert.ok(p.feedback.at(-1).deletedAt);
  await op("item.restore", { collection: "feedback", id: f.id });
  assert.ok(!p.feedback.at(-1).deletedAt);
  record("피드백 → 후속 스토리 연결, 휴지통과 복원");
  await op("project.delete");
  assert.ok(p.deletedAt);
  await op("project.restore");
  assert.ok(!p.deletedAt);
  record("프로젝트 삭제·복원 및 데이터 보존");
  mkdirSync("evidence", { recursive: true });
  writeFileSync(
    "evidence/api-flow-result.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        base,
        projectId,
        tests: results,
        note: "브라우저 코드 실행은 이 API 검증 범위에 포함되지 않음.",
      },
      null,
      2,
    ),
  );
  writeFileSync("evidence/verified-project.json", JSON.stringify(p, null, 2));
  writeFileSync(
    "data/sample-artifact-app.json",
    JSON.stringify(
      {
        files: { "index.html": html, "app.js": js },
        log: "합성 시연 코드. 실제 브라우저 검증 결과는 evidence 문서 확인.",
        source: "TeamVibe 합성 샘플",
      },
      null,
      2,
    ),
  );
  writeFileSync(
    "data/sample-artifact-style.json",
    JSON.stringify(
      {
        files: { "styles.css": css },
        log: "합성 시연 스타일. 실제 브라우저 검증 결과는 evidence 문서 확인.",
        source: "TeamVibe 합성 샘플",
      },
      null,
      2,
    ),
  );
  console.log(`Verified project: ${p.id}`);
} catch (error) {
  console.error(error);
  mkdirSync("evidence", { recursive: true });
  writeFileSync(
    "evidence/api-flow-failure.json",
    JSON.stringify(
      { at: new Date().toISOString(), results, error: String(error) },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
