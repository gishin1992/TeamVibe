import {copyFileSync,mkdirSync,writeFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const source='/Users/takykim/.codex/sessions/2026/09/21/rollout-2026-09-21T17-27-30-01a0c313-d00f-7a90-b2a2-632e4cb8f870.jsonl';
mkdirSync('evidence/agent-sessions',{recursive:true});const target='evidence/agent-sessions/01a0c313-d00f-7a90-b2a2-632e4cb8f870.jsonl';copyFileSync(source,target);writeFileSync('evidence/agent-sessions/manifest.json',JSON.stringify({threadId:'01a0c313-d00f-7a90-b2a2-632e4cb8f870',source,target,capturedAt:new Date().toISOString(),bytes:statSync(target).size,sha256:createHash('sha256').update(readFileSync(target)).digest('hex'),note:'실제 Codex 세션의 현재 시점 스냅샷. 이후 기록은 재실행하여 갱신. 로컬 보존만 수행.'},null,2));console.log(`Preserved actual session: ${target}`);
