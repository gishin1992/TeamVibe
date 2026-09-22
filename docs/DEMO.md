# TeamVibe 시연

권장 시작 프로젝트는 **비품 신청 · 수정과 취소를 보존하는 시연**입니다. `프로젝트 개요`에서 세 사람의 대화·PRD 동의와 완료2개를 보고, `테스트 랩`에서 품목과 수량3을 등록합니다. `수정`을 눌렀을 때 기존 목록과 수량이 남는지, 값을 바꾸고 `수정 취소`했을 때 원래 신청이 유지되는지 확인합니다. 공백 품목·0·소수 수량은 저장되지 않으며 정상 수정과 신청별 취소도 가능합니다. `실제 테스트 기록`에는 수행한 기준5개가 연결돼 있습니다.

이전 비품 신청 시연에서 수정 시작 시 원본이 사라지고 수량이1로 바뀌는 문제를 실제 독립 실행으로 발견했습니다. 이를 수정한 새 코드·프로젝트를 따로 만들고 원래 자료는 보존했습니다. 최신 독립 실행은 `evidence/safe-edit-preview.html`, 원본은 `data/demo-safe-edit/`, 근거는 `evidence/safe-edit-validation.json`입니다. 로컬 HTTP에서 실제10개 관찰과390px 화면을 확인했고, 플랫폼에서도 실행·검증 기록·완료 처리를 수행했습니다. 이 프로젝트의 준비는 로컬 API, 실제 실행과 기록은 UI로 했습니다. 새 설치 전체 UI 흐름의 근거와 구분합니다.

새 환경에서는 `TEAMVIBE_URL=실제_로컬_주소 node --experimental-strip-types scripts/prepare-safe-edit-demo.mjs`로 새 합성 프로젝트를 준비할 수 있습니다. 이 명령은 검증 기록을 자동 생성하지 않습니다. 완성 시연의 DB는 제출 압축에 포함하지 않으며 읽기용 스냅샷은 `evidence/safe-edit-final-project.json`에 있습니다. 최신 화면은 `evidence/screenshots/final-overview.png`, `safe-edit-mobile.png`입니다.

최신 압축의 별도 새 설치에서 **제출본 최종 협업 · 합성 확인 도구**를 만들고 전체 흐름을 UI로 검증했습니다. 확인·초기화 버튼과 스타일을 두 작업으로 나누어 반입·통합했고 실제 실행 뒤 기준2개를 연결한 기록1건으로 스토리2개를 완료했습니다. 이 프로젝트는 격리 설치의 DB에 있고 주 시연 서버에는 없습니다. 근거와 화면은 `evidence/submission-refresh-validation.json`, `evidence/screenshots/submission-refresh-ui-preview.png`를 참고하세요. 새 설치의 전체 UI 흐름과 기존 대표 비품 신청 앱 시연을 구분합니다.

제출 파일을 처음 받았다면 [처음 실행하기](START_HERE.md)를 확인합니다. `npm run submission:pack`으로 로컬 압축을 만들고, 새 폴더에서 `npm run submission:verify`로 무결성을 확인할 수 있습니다. 실제 압축 해제본의 새 의존성 설치·빌드·전체 API 검사와 UI 실행, 재시작 보존은 `evidence/submission-validation.json`에 기록했습니다. 새 설치의 테스트 프로젝트는 별도의 데이터 경로에 있으므로 현재 대표 시연 서버의 목록에는 나타나지 않습니다. `screenshots/submission-built-preview.png`는 압축 해제본에서 합성 버튼을 실제 클릭한 화면입니다.

**담당자 인계 · 진행 작업과 검증 보존**의 스토리 보드에는 박현우 담당의 `검증을 마친 확인 버튼`(v1/완료), 김지민 담당의 `결과를 기다리는 안내 화면`(v1/개발 중)이 있습니다. 각 카드의 담당자 버튼에서 변경·미지정을 선택하고, `담당 변경 이력`에서 이서연 담당 → 팀원 제외에 따른 해제 → 남은 팀원 인계를 확인합니다. 첫 스토리는 실제 버튼을 실행하고 기준1개를 연결한 테스트 기록으로 완료했습니다. 담당 인계 후에도 테스트 랩에서 `확인 전 → 확인 완료`를 다시 확인했습니다. 두 번째 작업은 결과 대기로, 구현 완료를 주장하지 않습니다. 실제15개 UI 관찰과 별도 동료 API 변경을 이용한 충돌 검사는 `evidence/story-assignment-browser-result.json`, 모바일390px 비교 화면은 `screenshots/story-assignment-mobile-conflict.png`입니다. 새로운 인계 시연은 `node scripts/prepare-story-assignment-demo.mjs`로 준비할 수 있으며 첫 스토리도 직접 실행·기록한 뒤 완료해야 합니다.

**결과 파일 읽기 · 재시도와 입력 보호**는 `첫 안내 화면`에 합성 파일 결과1개가 제출돼 있고 `별도 안내 화면`은 결과 대기입니다. 결과 반입 창에서 `evidence/file-import-invalid.json` 또는 `file-import-oversize.json`을 선택하면 기존 입력을 유지한 오류 안내를 볼 수 있습니다. `file-import-valid.json`은 첫 작업 전용이며 다른 작업에 저장하면 문맥 불일치로 거절됩니다. 실제 브라우저에서 정상 파일·동일 파일 재선택·잘못된 대체 파일·닫기 보호·최종 저장11건을 확인했습니다. `file-import-browser-result.json`과 `screenshots/file-import-mobile-error.png` 참고. 이 예제는 파일 반입 검증이며 코드 통합·실행은 하지 않았습니다. 느린 파일 읽기의 경합은 별도 Node 비동기 도우미 검사이며 실제 브라우저 지연 재현과 구분합니다.

**통합 검토 초안 · 작업 묶음별 보존**은 두 합성 작업의 서로 다른 `index.html`을 비교하고 보존한 통합 초안으로 만든 결과입니다. 현재 `테스트 랩`에서 `확인하기`를 누르면 `확인 전/0 → 확인 완료/1 → 확인 완료/2`가 됩니다. 이 두 동작을 실제 실행해 남긴 테스트 기록1건이 두 스토리 기준과 연결돼 있으며 스토리는 검토 대기입니다. 이전 제출 로그의 ‘아직 실행하지 않음’ 문구는 제출 시점 기록으로 그대로 보존했습니다. `evidence/integration-drafts-browser-result.json`의14관찰과 `screenshots/integration-drafts-mobile-review.png`에서 화면·작업선택·프로필 이동 뒤 입력 보존과 오래된 검토 기준 차단을 확인할 수 있습니다. 현재 작업들은 이미 통합돼 다시 선택할 수 없습니다. 보존 동작을 다시 시연하려면 `node scripts/prepare-integration-drafts-demo.mjs`로 새 합성 프로젝트를 만들고 두 작업을 선택해 검토합니다. 기존 프로젝트는 수정하지 않습니다.

**설계 자료 보존 · 신청 프로젝트**에서 `공동 PRD → ChatGPT로 요구사항 정리`에 응답을 입력하고 창을 닫아 다른 화면으로 이동합니다. 돌아오면 요청과 응답이 남고 `내용 검토`를 다시 거쳐야 합니다. 스토리 설계도 같은 방식이며 사용자·프로젝트·두 설계 종류가 분리됩니다. `작성 중인 자료 지우기`는 확인 후 현재 자료만 비웁니다. 실제 시연에서는 합성 스토리 JSON을 파일로 가져와 백로그1개를 등록했고, 보존된 요구사항 JSON의 오래된 버전 차단을 확인한 뒤 최신 기준으로 재검토해 검토대기1개를 등록했습니다. 자동 AI 실행이나 구현 테스트는 하지 않았습니다. `evidence/planning-drafts-browser-result.json`의 실제 관찰18건과 `screenshots/planning-drafts-mobile-reset.png`를 참고합니다. 새로고침 후 복구는 지원하지 않습니다.

**편집 중인 문서 · 닫기 전 입력 보존**의 `공동 PRD → 편집`에서 문장을 추가하고 Escape를 누릅니다. `계속 작성`으로 입력이 남는지 확인하고, `취소 → 변경 내용 버리기`로 저장된 문서를 유지한 채 닫을 수 있습니다. 현재 PRD v3은 이서연의 처리 상태 검토와 김지민의 반려 사유 검토를 비교한 뒤 실제 UI에서 합쳐 저장한 본문입니다. 오류·충돌·모바일·프로필 삭제 취소/확인/복원을 포함한 실제 관찰 21건은 `evidence/unsaved-form-browser-result.json`에 있습니다. 시연 화면은 `evidence/screenshots/unsaved-form-mobile-confirm-settled.png`입니다. 새로고침 후 자동 복구나 별도 설계·통합 창 보호는 구현 범위에 포함하지 않습니다.

**개발 결과 수정 · 이전 코드 보존**의 `병렬 개발 → 결과 수정 이력 2개`에서 김지민의 첫 결과v1, 이서연의 수정 결과v2, 첫 JSON을 다시 반입한 현재 결과v3을 볼 수 있습니다. 실제 UI에서 v1 JSON을 읽어 같은 작업에 재반입하고 통합했습니다. 미리보기의 `결과 확인하기`를 눌러 `확인 전 → 첫 결과 실행 확인`을 관찰해 테스트 기록1건과 스토리 기준1개 연결을 남겼습니다. 스토리는 검토 대기로 남겨 자동 완료와 구분합니다. 통합된 작업의 결과 수정은 막히고 이력은 계속 읽을 수 있습니다. `evidence/run-submissions-browser-result.json`, `run-submissions-browser-final-project.json`, `run-submissions-v1-export.json`, `screenshots/run-submissions-mobile-history.png` 참고. 반입 시점의 ‘브라우저 미실행’ 원문 로그는 수정하지 않았으며 이후 실제 버튼 검증은 별도 테스트 기록에 남아 있습니다.

**공동 PRD · 작성과 복원 이력**에서 `공동 PRD → 버전 기록`을 열면 김지민이 작성한 v1, 이서연이 작성한 v2, 김지민이 v1 본문으로 복원한 현재 v3을 볼 수 있습니다. v1의 작성자는 김지민, 보관자는 이서연이며 v2의 작성자는 이서연, 보관자는 김지민입니다. 실제 모바일 UI에서 복원을 실행했고 두 팀원의 동의는 검토 대기로 돌아갔습니다. 현재 v3의 동의는0명으로 남겨 명시적인 재검토가 필요한 상황을 보여 줍니다. 초기 빈 v0은 복원할 수 없다는 안내가 있습니다. `evidence/prd-history-browser-result.json`, `prd-history-browser-final-project.json`, `prd-history-server-result.json`, `screenshots/prd-history-mobile.png` 참고. 기존 대표 시연 문서의 미기록 작성자는 추정하지 않고 그대로 표시합니다. 이 예제는 문서 이력 시연이며 업무 앱 구현·실행이 아닙니다.

**보관한 요구사항 · 변경된 원문 재검토**는 당일 취소 요구사항을 보관한 동안 원문이 3일 취소로 바뀐 예제입니다. 실제 UI에서 휴지통 복원 후 검토 대기/동의 차단을 확인하고, 수정 이력의 원래 합의와 출처의 v1·v2를 비교했습니다. 이후 요구사항을 3일 취소로 재합의하고 PRD v2에 동의했습니다. 현재 `공동 PRD → 요구사항 → 요구사항 수정 이력 2개`에서 최초 합의, 복원 시 재검토, 최종 재합의를 볼 수 있습니다. `대화 출처 → 출처 연결 변경 이력`에는 당일 취소 원문 v1이 남습니다. `evidence/requirement-restore-browser-result.json`, `requirement-restore-browser-final-project.json`, `screenshots/requirement-restore-mobile-sources.png`에 실제 관찰이 있습니다. 이 예제는 문서 검토 흐름이며 취소 기능을 구현하거나 실행 테스트한 것은 아닙니다.

**미리보기 실행 오류 · 수정 확인**은 의도적 오류가 있는 화면과 이를 제거한 화면을 함께 보존한 예제입니다. 현재 수정본이 활성화되어 있습니다. `테스트 랩 → 릴리스 이력`에서 `오류가 있는 합성 화면 → 이 버전으로 테스트`를 선택하고 미리보기로 돌아오면 시작 문법 오류가 보입니다. 버튼으로 실행·비동기 오류를 만들고, 오류 내용을 복사하거나 다시 실행해 초기화를 확인할 수 있습니다. `오류 30건 만들기`는 표시 상한 20건을 보여줍니다. 이 화면의 격리 검사 주소는 검증 당시의 임시 로컬 서버이며 현재 서버는 종료했습니다. 새 수신 검증이 필요하면 `node scripts/prepare-preview-diagnostics-demo.mjs`로 새 합성 프로젝트와 임시 서버를 만들고 종료할 때 Ctrl+C를 누릅니다.

수정 릴리스에서 `확인하기`의 `확인 전 → 확인 완료`를 실제 관찰했습니다. 진단 표시만으로 테스트나 스토리를 자동 완료하지 않았습니다. `evidence/preview-diagnostics-browser-result.json`, `preview-diagnostics-server-result.json`, `preview-diagnostics-copied.txt`와 `screenshots/preview-diagnostics-mobile.png`가 근거입니다.

**병렬 결과 반입 · 작업 일치 확인**은 다른 작업의 응답과 최상위 `id`가 있는 JSON을 거절한 뒤, 올바른 HTML·CSS 응답을 파일 선택기와 붙여넣기로 반입한 예제입니다. 두 결과를 UI에서 통합하고 모바일 미리보기에서 버튼 문구 변경과 별도 CSS 적용을 직접 관찰해 테스트 기록 1건(기준2개 연결)을 남겼습니다. 스토리는 검토 대기로 남겨 자동 완료와 구분합니다. `data/sample-run-result-app.json`, `sample-run-result-style.json`에는 이 작업에 고정된 context가 있으므로 새 작업에서는 새 요청 값을 사용해야 합니다. `evidence/run-result-browser-result.json`, `run-result-browser-final-project.json`, `screenshots/run-result-context-mobile-rejected.png`에 실제 관찰이 있습니다.

**스토리 편집 · 완료 상태 보존**은 실제 버튼의 `확인 전 → 확인 완료`를 관찰한 뒤 완료 처리하고, 편집 양식을 그대로 저장해 스토리v1/완료가 유지되는 것을 확인한 예제입니다. 이후 완료 조건을 횟수 확인으로 바꾸어 현재 스토리는 v2/백로그입니다. `개발 작업 → 개발 요청과 시작 코드 보기`와 `테스트 랩 → 검증 기록 → 검증 당시 테스트 기준`에서 v1 원래 기준을 읽을 수 있습니다. v2 횟수 기능은 구현·검증하지 않았으며 과거 통과가 새 기준의 완료를 대신하지 않습니다. `evidence/story-editing-browser-result.json`, `story-editing-browser-after-noop.json`, `story-editing-browser-final-project.json` 및 `screenshots/story-editing-mobile-preserve.png`에 실제 관찰을 보존했습니다.

**요구사항 결정 이력 · 팀 검토**에서 `공동 PRD → 요구사항 → 요구사항 수정 이력 4개`를 열면 최초 신청 취소(v1), 팀원 수정(v2), 취소 사유 통합(v3), 재합의(v4), 원문 변경으로 검토 대기(v5)를 확인할 수 있습니다. 최초 작성자 김지민과 변경자 이서연, 당시 제목·내용·결정 근거가 남아 있습니다. 실제 UI 휴지통 이동·복원 후에도 전체 요구사항이 같음을 확인했습니다. 현재 PRD는 재검토 상태이며 과거 합의가 다시 동의를 채우지 않습니다. `evidence/requirement-history-browser-result.json`, `requirement-history-browser-final-project.json`, `screenshots/requirement-history-desktop-settled.png`, `screenshots/requirement-history-mobile.png` 참고. 이 예제에는 개발된 업무 앱이나 실행 테스트가 없습니다.

## 3분 둘러보기

1. `npm run dev`가 출력한 로컬 주소에서 김지민 프로필을 선택합니다. 이 작업의 주소는 `http://localhost:5174`입니다.
2. 프로젝트 선택에서 **비품 신청 · 팀 협업 시연**을 엽니다. 원래 기본 비품 샘플과 구별합니다.
3. **아이디어 대화**: 김지민·이서연·박현우의 합성 의견 3건을 보여줍니다. 개인 대화를 프로젝트에서 함께 볼 수 있습니다.
4. **공동 PRD**: 합의된 요구사항 2건, PRD v1, 3명의 동의를 확인합니다. 문서 편집 시 재동의가 필요한 구조입니다.
5. **스토리 보드**: 동작과 스타일을 독립 작업으로 나눈 스토리 2건을 보여줍니다. **개발 작업**에서 작업별 프롬프트와 실제 반입한 합성 코드·로그를 확인합니다.
6. **테스트 랩**: 품목 ‘시연용 키보드’, 수량 ‘2’를 신청하고 수정·취소합니다. 새로 실행하면 샘플 앱의 메모리 상태는 초기화됩니다.
7. **검증 기록**: 실제 실행한 기능 검증과 반응형 검증 기록, 각각 연결된 테스트 기준을 보여줍니다. 스토리 2건의 완료는 이 기록과 통합 릴리스에 연결되어 있습니다.
8. **활동 기록 → 제출 자료**와 **테스트 랩 → 실행 HTML 저장**의 결과물 보존 경로를 설명합니다. 제출 폴더에는 JSON, 원본 코드, 독립 실행 HTML, 실제 세션 로그가 이미 있습니다.

## 새 프로젝트로 흐름 재현하기

새 프로젝트를 만들고 별도 브라우저 세션을 2개 더 열어 초대 코드로 참여합니다. 각자 대화 → 요구사항 등록 → 검토·합의 → PRD 초안과 동의 → 스토리 분할·검토 → 독립 스토리 동시 시작 순서로 진행합니다.

개발 작업은 사용자가 ChatGPT에 프롬프트를 직접 전달하는 방식입니다. 기존 시연에서는 외부 전송 없이 `data/sample-artifact-app.json`, `data/sample-artifact-style.json`을 파일 선택기로 반입했습니다. 이 파일들은 작업 문맥 검증 도입 이전의 응답이며 새 작업에는 해당 개발 요청의 context가 필요합니다. 두 작업의 담당 파일이 다르므로 충돌 없이 통합할 수 있습니다. 실제 ChatGPT 자동 호출이나 자동 코드 생성이 실행됐다고 설명하지 않습니다.

## 제출 증거 읽기

**문서 검토 · 변경 없는 저장 검사**에서는 동의2개가 있는 요구사항과 PRD를 실제 UI에서 내용 변경 없이 저장해 동의가 유지되는 것을 확인했습니다. 이서연 API 세션이 의견 충돌을 만들자 모바일 동의 버튼이 비활성화되고 `합성 검토 기준` 이름과 PRD 갱신 안내가 나타났습니다. `미해결 요구사항 검토`에서 기존 합의로 다시 정리한 뒤, 문서에 이미 같은 내용이 있으므로 PRD를 그대로 저장해 반영 기준을 새 버전으로 기록했습니다. 김지민은 UI, 이서연은 별도 API 세션으로 재동의했습니다. 최종PRD v3/동의2, `prd-review-browser-result.json`, `prd-review-browser-final-project.json`, `screenshots/prd-review-blockers-mobile.png`에 근거가 있습니다.

초기 실행 검사는 **별도 데이터 경로**에서 수행했습니다. 빈 데이터베이스의 화면과 상태 API가 초기화 필요를 알리고, 마이그레이션 후 `다시 시도`로 합성 프로필3개가 표시됐습니다. 새 프로젝트를 실제 UI로 만든 뒤 기본 샘플·프로필을 수정하고 초기화 재실행/개발 서버 전환/빌드 서버 재시작 후 사용자3명·프로젝트2개 전체 동일성을 확인했습니다. 기존 대표 시연 프로젝트도 변화가 없습니다. `fresh-start-browser-result.json`, `fresh-start-after-reinit.json`, `fresh-start-after-dev.json`, `fresh-start-after-built-restart.json`, `screenshots/fresh-start-dev-persisted.png`를 참고합니다. 검증용 서버는 종료했으며 데이터는 `.sites-runtime/fresh-start-uIT67w/state`에 보존했습니다. 의존성은 재사용했으므로 새로운 컴퓨터의 패키지 설치 검증은 아닙니다.

**릴리스별 검증 · 이전 기준 보존**은 안내 화면 v1의 `팀 검토 준비` 제목을 실제 관찰해 기록한 뒤, 스토리·테스트 기준을 v2의 `팀 검토 완료`로 변경한 시연입니다. v1 릴리스를 휴지통에 보관한 상태에서도 이전 기록을 찾아 설명을 수정했고, 기준에는 계속 `이전 안내 문구 v1`과 원래 문구가 남습니다. v2도 미리보기에서 제목을 직접 확인해 별도 기록했습니다. 모든 릴리스·현재·개별 릴리스/결과 필터, 모바일 배치, 이전 기록의 삭제·복원 및 수정 전 기준을 확인했습니다. `test-record-browser-result.json`, `test-record-browser-final-project.json`, `screenshots/test-record-criterion-mobile-final.png`, `screenshots/test-record-prior-criterion-desktop.png`를 참고합니다. 정적 제목 표시 검증이며 업무 기능을 구현·검증했다는 주장은 아닙니다. 가시성 도구의 false 2건은 원본에 남기고 DOM·스크린샷 확인을 별도 기록했습니다.

**검증 기록 이력 · 팀 검토 시연**에서는 김지민 프로필로 미리보기의 확인 횟수 `0→1`을 실제 관찰해 기록한 뒤, 이서연 프로필로 설명만 보완했습니다. `테스트 랩 → 검증 기록 → 검증 기록 수정 이력 1개`를 열면 현재 v2의 수정자와 이전 v1의 원작성자·실제 결과를 비교할 수 있습니다. 모바일에서 이전 기록까지 스크롤했고, UI 휴지통 이동·복원 후 전체 테스트 기록이 이전과 동일함을 서버에서도 비교했습니다. `test-history-browser-result.json`, `test-history-browser-final-project.json`, `screenshots/test-history-*-mobile.png`를 참고합니다. 설명 수정 시 테스트를 다시 실행했다고 주장하지 않으며 실패·진행 불가의 완료 차단은 별도 합성 API 검사입니다.

**개발 시작 조건 · 선행 작업 시연**에서는 조건을 충족하지 못한 스토리를 보드에서 미리 구분합니다. 두 스토리를 선택한 상태에서 별도 세션이 하나를 백로그로 바꾸자 선택은 유지되고 시작이 차단됐습니다. 해당 선택만 해제한 뒤 독립 작업만 시작했습니다. 이어 실제 미리보기의 `선행 화면 확인` 제목을 관찰해 정확한 테스트 기준을 기록하고 선행 스토리를 완료하자 후속 선택이 열렸습니다. 검증 기록을 휴지통에 옮기면 다시 막히고, 복원·재완료 후 유지한 후속 선택으로 실제 수동 작업을 시작했습니다. `readiness-browser-result.json`, `readiness-browser-final-project.json`, `screenshots/readiness-mobile-*.png`에 근거가 있습니다. 최종 후속 작업은 수동 결과 대기 상태이며 외부 AI가 실행 중이라는 뜻이 아닙니다.

**다음 작업 안내 · 단계 이동 시연**은 독립 스토리 2개를 실제 UI에서 시작하고 합성 HTML/CSS를 각각 반입·통합한 예제입니다. 작업 시작 후 개발 목록, 통합 후 미리보기로 자동 이동했고 모바일 버튼의 `확인 전 → 확인 완료`를 관찰했습니다. `개발 작업`은 통합 후에도 전체 2개로 표시합니다. 현재는 동의 철회를 검증한 상태로, 기존 릴리스가 있어도 개요에서 PRD 재검토를 안내합니다. `workflow-browser-result.json`, `workflow-browser-final-project.json`, `screenshots/workflow-next-integration.png`, `screenshots/workflow-mobile-preview.png`를 참고합니다. 스토리 완료나 테스트 기준 통과 처리는 하지 않았습니다.

**파일 제외와 팀 변경 · 통합 검토 시연**에서는 `legacy.js`의 제외 요청과 동료의 문구 수정을 비교한 뒤 새 릴리스에서 제외했습니다. 실제 파일 선택기로 `data/sample-artifact-removal.json`을 반입하고 모바일 통합 검토에서 삭제 선택과 이유를 입력했습니다. 테스트 랩에서 새 안내와 `확인 횟수` 버튼의 0→1 동작을 확인한 기록 1건이 있습니다. `릴리스 이력`의 제외 파일·해결 근거를 확인하고 이전 릴리스로 전환하면 원래 안내가 복원됩니다. `artifact-removal-browser-result.json`, `artifact-removal-browser-final-project.json`, `screenshots/artifact-removal-*.png`를 참고합니다. 제출 원본과 이전 코드의 물리 삭제는 없습니다.

**릴리스 간 피드백 · 후속 작업 시연**의 `테스트 랩 → 팀 피드백`에서는 새 릴리스와 이전 릴리스의 피드백을 함께 추적합니다. 발견 릴리스는 휴지통에 보관돼 있지만 피드백과 원작성자는 유지됩니다. 연결된 후속 스토리를 실제 UI로 복원·수정했고, 피드백 종결 → 다시 열기 → 재종결 → 휴지통 → 복원 후에도 해결 이력 2건과 같은 스토리 연결이 남았습니다. `전체 해결 이력`을 펼쳐 확인합니다. `feedback-browser-result.json`, `feedback-browser-final-project.json`, `screenshots/feedback-mobile-history.png`에 관찰과 최종 상태가 있습니다. 이 시연의 종결 이유는 합성 안내 문구 관찰이며 업무 기능의 수정·완료를 주장하지 않습니다.

비개발자 흐름 보완은 **ChatGPT 충돌 해결안 · 합성 반입**에서 보여줍니다. 두 제출 작업의 충돌 자료를 요청 문서로 확인하고 합성 해결안 JSON을 실제 파일 선택기로 반입했습니다. 검토 양식에 불러오기만 했을 때 서버 릴리스는 0건이었고, 근거 수정과 명시적 통합 후 새 릴리스 1건이 생성됐습니다. 테스트 랩에 신청·취소 안내 두 문장이 있고, 릴리스 이력에는 수동 반입 출처와 팀의 최종 검토 근거가 있습니다. `resolution-transfer-before-confirm.json`, `resolution-transfer-browser-result.json`을 참고합니다.

스토리 편집의 선행 작업과 요구사항은 이름으로 선택합니다. `story-named-links-browser-result.json`은 실제 UI 선택·해제·복원과 편집 중 사라진 선택 후보 처리의 서버 확인 결과입니다.

통합 충돌 처리는 **병렬 결과 통합 · 충돌 해결 시연**에서 확인합니다. 개발 작업의 `개발 요청과 시작 코드 보기`에 초기 코드가 남아 있고, 테스트 랩에는 검색 안내와 합계 안내 두 문장을 모두 보존한 최종 HTML이 실행됩니다. 릴리스 이력의 `파일 충돌 해결 1건`을 펼치면 검토 근거와 작성자가 나타납니다. 이 예제는 정적 안내 문장의 보존 검사이며 실제 검색·합계 계산 기능 구현을 주장하지 않습니다. `integration-browser-result.json`, `integration-browser-project.json`에 실제 관찰과 저장 상태가 있습니다.

스토리 설계 반입을 보여주려면 **ChatGPT 스토리 설계 · 합성 시연** 프로젝트를 엽니다. 스토리 보드에 독립 작업 2개와 선행 작업을 요구하는 요약 작업 1개가 있습니다. 완료 조건을 펼치면 수동 반입 출처가 보입니다. `ChatGPT로 스토리 설계`에서 요청 내용과 반환 형식을 확인할 수 있습니다. `data/sample-story-plan.json`은 이미 반입한 예제여서 재등록 시 중복을 차단합니다. 새로운 반입은 새 프로젝트의 최신 요청에 맞춘 JSON으로 시연하세요.

- `evidence/story-planning-browser-project.json`: 실제 파일 반입, 제목 수정, 휴지통과 복원 후의 서버 상태.
- `evidence/story-planning-browser-result.json`: 실제 UI 검증과 미검증 범위.
- `evidence/screenshots/story-plan-review-mobile.png`, `story-plan-review-desktop.png`: 설계 검토 화면.

- `evidence/demo-final-project.json`: 플랫폼에 저장된 시연 상태의 스냅샷.
- `evidence/demo-browser-steps.json`: 실제 브라우저 등록·수정·취소와 잘못된 입력 검사의 관찰값.
- `evidence/demo-export.json`: 릴리스, 기준별 검증 기록과 완료 상태 요약.
- `evidence/screenshots/demo-mobile-form-list.png`, `demo-desktop-form-list.png`, `demo-stories-done.png`: 시연에 사용할 화면.
- `evidence/VERIFICATION.md`: 실제 실행한 범위와 미검증 범위.
- `evidence/agent-sessions/`: 현재 작업의 실제 원본 세션 스냅샷과 SHA-256 manifest. 앱 활동 로그나 합성 AI 로그와 별개입니다.

현재 프로필 선택은 실제 계정 인증이 아닌 로컬 시연 기능입니다. 실제 업무 데이터, 외부 서비스 연결, 유료 API, 공개 배포는 사용하지 않았습니다.

**대화 출처 연결 · 변경과 검토**의 `공동 PRD → 요구사항`에서 **팀이 보완한 취소 범위**를 엽니다. 현재 출처는 최초 의견과 합성 ChatGPT 응답 2개이며 `대화 출처 2개 보기 → 출처 연결 변경 이력 5개`에 교체·해제·최신 버전 재연결·동시 편집 전의 근거가 남아 있습니다. 담당자의 원문은 v2로 수정됐지만 이전 연결 이력에는 v1 문구가 그대로 보입니다. 실제 UI에서 출처를 고르고 해제했으며, 같은 목록의 동시 변경을 비교해 내 출처와 팀의 제목 변경을 함께 저장했습니다. 휴지통 원문도 조회·유지 가능함을 확인한 뒤 합성 원문을 복원했습니다. 요구사항은 검토 대기이며 PRD 재동의는 의도적으로 남겨 두었습니다. 증거: `source-links-browser-result.json`, `source-links-browser-final-project.json`, `screenshots/source-link-history-mobile.png`.

**팀 대화에서 요구사항 · 합성 반입**은 두 사람의 취소 정책 의견을 공동 요구사항으로 정리하는 시연입니다. `공동 PRD → 요구사항`에 기존 합의 항목 1개, 반입한 검토 대기 1개와 의견 충돌 1개가 있습니다. `요구사항 정리 출처`와 `대화 출처`에서 합성 응답 표기와 원문 버전을 볼 수 있습니다. 신청 항목은 실제 UI 편집·휴지통·복원 후 같은 ID와 출처가 유지됩니다. 승인 후 취소 정책은 의도적으로 충돌 상태를 유지했으며, PRD 동의는 해제되어 팀의 판단을 기다립니다.

`ChatGPT로 요구사항 정리`에서 두 팀원의 대화와 기존 요구사항을 포함하는 요청을 직접 표시합니다. 시연에서는 실제 파일 선택기로 `data/sample-requirement-plan.json`을 불러와 원문을 펼쳐 보고 모바일에서 명시적으로 등록했습니다. 검토 중 다른 세션에서 원문이 바뀌자 오래된 제안 등록이 막혔고, 최신 요청·응답으로 재검토했습니다. `requirement-before-import-review.json`은 검토만 했을 때 서버가 그대로였다는 증거이며, `requirement-after-ui-import.json`, `requirement-browser-final-project.json`, `requirement-browser-result.json`, `screenshots/requirement-review-mobile.png`, `requirement-imported-desktop.png`에 실제 수행 결과가 있습니다. 샘플은 이미 반입했으므로 같은 묶음 재사용은 중복 안내가 나옵니다.

초안 분리를 시연하려면 **대화 초안 · 분리 시연**에서 김지민의 신청·승인 대화를 번갈아 엽니다. 각 입력창에 다른 내용을 적고 이동하면 해당 초안이 돌아옵니다. **대화 초안 · 별도 프로젝트** 및 이서연 프로필도 별도 초안을 유지합니다. 신청 대화에는 실제 전송한 합성 메시지 1건이 있고 다른 대화는 비어 있습니다. 초안은 현재 페이지 메모리에만 있으며 새로고침하면 사라집니다. 실제 관찰은 `evidence/draft-browser-result.json`, 서버 상태는 `draft-browser-final-projects.json`, 모바일 화면은 `screenshots/conversation-draft-mobile.png`에 있습니다.

프로젝트 선택 창에서 `파란 노트`를 검색하면 **프로젝트 찾기 · 파란 노트**가 나옵니다. 이름을 수정하고 휴지통에 보관한 뒤 실제 모바일 UI로 복원했으며 원래 대화가 유지됩니다. `휴지통`에서 `초록 노트`를 검색하면 같은 이름 구분 검사에 사용했던 **프로젝트 찾기 · 보관 복원 시연**이 나옵니다. 이 프로젝트는 보관 상태로 유지했습니다. `project-picker-browser-result.json`, `project-picker-final-projects.json`, `screenshots/project-picker-trash-desktop.png`, `project-picker-trash-mobile.png`가 실제 증거입니다. 모바일 프로필 전환 알림은 메뉴 아래에 표시되며 `알림 닫기`로 닫을 수 있습니다.

## 늦은 갱신 응답 검증

`늦은 갱신 · 자동 갱신 복구 확인`은 합성 메타데이터 검증 프로젝트입니다. 로컬 프록시로 저장보다 늦게 오는 응답을 재현했고, 수정 후 최신 이름 유지·작성 설명 보존·충돌 비교·시간 초과 후 갱신 복구를 확인했습니다. 실제 업무 앱 시연은 대표 비품 신청 프로젝트를 사용합니다. 상세 근거는 `evidence/workspace-refresh-validation.json`입니다.
