# TeamVibe 처음 실행하기

TeamVibe는 여러 팀원의 아이디어를 공동 PRD, 사용자 스토리, 개발 결과와 테스트로 연결하는 **로컬 해커톤 프로토타입**입니다. ChatGPT 요청과 응답은 사람이 직접 전달합니다. AI 백엔드·실제 업무 시스템 연결·외부 배포는 없습니다.

## 1. 제출 파일 확인

압축 파일을 새 폴더에 풀고 `TeamVibe` 폴더에서 실행합니다. Node.js 22.13 이상, npm이 필요합니다. 검증 환경은 macOS와 Node.js 24.16.0입니다. 제출 압축을 별도 폴더에 풀어 기존 node_modules를 재사용하지 않고 npm 캐시만으로 새 설치·빌드·실행·재시작 보존을 확인했습니다. 캐시 없는 다운로드와 다른 운영체제는 미검증입니다.

```sh
npm run submission:verify
```

제출 목록의 각 파일 크기와 SHA-256을 비교합니다. 설치나 브라우저가 필요 없으며 서버를 켜지 않습니다. 목록 밖 추가 파일은 검사하지 않습니다. 이 명령의 성공은 파일 무결성 확인이며 앱 기능 테스트 통과를 의미하지 않습니다.

## 2. 플랫폼 실행

```sh
npm ci
npm run db:init
npm run dev
```

`Local` 주소를 브라우저에서 엽니다. 기본 포트는5173이며 사용 중이면 다음 포트를 사용합니다. 김지민·이서연·박현우의 합성 시연 프로필이 제공됩니다. 사용자 데이터를 지우지 않도록 초기화는 미적용 마이그레이션만 수행합니다.

- 새 설치에는 기본 합성 프로젝트가 생성됩니다. 개발 당시의 모든 검증 프로젝트를 데이터베이스로 가져오지는 않습니다.
- `만들기`로 프로젝트를 만들고, `팀 관리`의 초대 코드로 다른 시연 프로필이 참여합니다.
- `아이디어 대화 → 공동 PRD → 스토리 보드 → 개발 작업 → 테스트 랩` 순서로 진행합니다. 각 프로필의 PRD 동의가 필요합니다.
- 독립 스토리 여러 개를 시작해 별도 ChatGPT 세션에 요청을 전달하고, 결과 JSON을 각 작업에 가져온 뒤 통합합니다. 이 앱은 ChatGPT를 자동 실행하지 않습니다.
- 전체 시연 방법과 수정·휴지통·복원 방법은 [README](../README.md), 실제 검증 프로젝트 설명은 [DEMO](DEMO.md)에 있습니다.

같은 브라우저의 탭은 로그인 쿠키를 공유합니다. 서로 다른 사용자 세션을 동시에 보여주려면 별도 브라우저 프로필이나 시크릿 창을 사용합니다. 프로필 선택은 합성 시연 기능이며 실제 사용자 인증이 아닙니다.

## 3. 완성된 합성 업무 앱 보기

최신 권장 시연은 **비품 신청 · 수정과 취소를 보존하는 시연**입니다. `evidence/safe-edit-preview.html`에 독립 실행 HTML, `data/demo-safe-edit/`에 원본 코드, `evidence/safe-edit-final-project.json`에 PRD·작업·실제 테스트 기록이 있습니다. 수정 시작·수정 취소·입력 오류 때 원래 신청과 수량을 보존하며, 390px 화면을 포함해 기준5개를 실제 검증했습니다. 별도 로컬 HTTP 주소에서 독립 실행했고 `file://` 직접 열기는 확인하지 않았습니다. 새 시연은 `node --experimental-strip-types scripts/prepare-safe-edit-demo.mjs`로 준비하며 검증 기록은 직접 실행 후 남겨야 합니다.

이전 시연의 수정 버튼이 기존 신청을 먼저 없애고 수량을1로 되돌리는 문제를 마지막 독립 실행 검사에서 발견했습니다. 이전 코드와 기록은 비교용으로 보존했습니다. 아래 `demo-*` 파일은 이전 시연의 자료이며 최신 실행에는 `safe-edit-preview.html`을 사용하세요.

`evidence/demo-preview.html`과 `evidence/demo-code/`에 비품 신청 앱의 실행 HTML과 코드가 있습니다. `evidence/demo-final-project.json`은 실제로 시연한 공동 프로젝트의 PRD·스토리·코드·테스트 기록을 보존한 읽기용 자료입니다. 이 스냅샷의 자동 프로젝트 반입 기능은 없습니다.

최신 대표 화면:

- [팀 프로젝트 개요](../evidence/screenshots/final-overview.png)
- [모바일 수정과 원본 보존](../evidence/screenshots/safe-edit-mobile.png)

이전 시연의 보존 화면:

- [팀 프로젝트 개요](../evidence/screenshots/demo-overview-final.png)
- [모바일 신청·수정·취소](../evidence/screenshots/demo-mobile-form-list.png)
- [데스크톱 신청 목록](../evidence/screenshots/demo-desktop-form-list.png)
- [검증 완료 스토리](../evidence/screenshots/demo-stories-done.png)

미리보기는 외부 통신을 차단한 격리 iframe입니다. 지원 파일은 HTML/CSS/JavaScript 등 정적 결과이며 임의 서버 코드는 실행하지 않습니다. 과거 통과 기록이 새 기능의 검증을 대신하지 않습니다.

## 4. 검사와 빌드 실행

플랫폼 개발 서버가 실행된 상태에서 별도 터미널에서 실제 주소를 지정합니다. API 검사는 새 합성 프로젝트를 생성하므로 사용자 프로젝트에 섞고 싶지 않으면 README의 별도 데이터 경로를 사용하세요.

```sh
npm run typecheck
TEAMVIBE_URL=http://localhost:5174 npm test
```

빌드된 서버를 실행하려면:

```sh
npm run build
npm start -- --port 8788
```

새 데이터 경로를 지정했다면 `db:init`, 개발 서버, 빌드된 서버에 같은 `TEAMVIBE_STATE_PATH`를 사용하세요. 기존 `.wrangler/state`는 삭제하지 마세요. Windows의 환경변수 지정 방식과 별도 운영체제 실행은 확인하지 않았습니다.

## 5. 검증 근거와 한계

[완료 기준과 검증 근거](ACCEPTANCE.md)에서 핵심 요구사항별 결과를 볼 수 있습니다. 최신 제출본의 UI 전체 흐름·새 설치·재시작 결과는 `evidence/submission-refresh-validation.json`에 있습니다.

[실제 검증 기록](../evidence/VERIFICATION.md)은 실제 UI 실행과 합성 API 상태 검사를 구분합니다. 각 `*-validation.json`에는 해당 검사 시점과 범위, 소스 해시가 있습니다. 과거 기록은 당시 버전을 검증한 결과이며 최신 코드의 모든 동작을 자동으로 보증하지 않습니다.

`evidence/agent-sessions/manifest.json`은 같은 폴더의 **실제 Codex 세션 로그** 보존 시점·바이트 수·해시를 기록합니다. 로그는 그 시점까지의 스냅샷이며 이후 대화는 포함하지 않습니다. 제출 압축은 로컬에서만 만들어지며 자동 전송되지 않습니다.

초안 일부는 현재 페이지 메모리에만 있어 새로고침 후 복구되지 않습니다. 실서비스 인증·알림·Git 자동 병합·자동 AI 실행·운영 배포는 범위 밖입니다. 상세 한계는 README에 있습니다.
