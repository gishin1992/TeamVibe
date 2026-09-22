import { getDb } from "@/lib/db";
import { createProject, mutate, DomainError, id } from "@/lib/teamvibe/domain";
import { demoUsers, sampleProject } from "@/lib/teamvibe/seed";
import type { Project, User } from "@/lib/teamvibe/types";
export const dynamic = "force-dynamic";
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
const db = () => getDb();
const databaseSetupMessage =
  "데이터베이스 연결에 실패했습니다. TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 환경 변수를 확인하세요.";
async function databaseReady() {
  const d = db();
  await d.ensureSchema();
  await d.batch([
    d.prepare("SELECT id, archived FROM users LIMIT 0"),
    d.prepare("SELECT id, version, data FROM projects LIMIT 0"),
    d.prepare("SELECT token, user_id, expires_at FROM sessions LIMIT 0"),
  ]);
}
async function seed() {
  await databaseReady();
  const d = db();
  await d.batch(
    demoUsers.map((u) =>
      d
        .prepare(
          "INSERT OR IGNORE INTO users (id,name,role,color) VALUES (?,?,?,?)",
        )
        .bind(u.id, u.name, u.role, u.color),
    ),
  );
  const p = sampleProject();
  await d
    .prepare("INSERT OR IGNORE INTO projects (id,version,data) VALUES (?,?,?)")
    .bind(p.id, p.version, JSON.stringify(p))
    .run();
}
async function identity(req: Request) {
  const cookie = req.headers.get("Cookie") || "";
  const token = cookie.match(/(?:^|; )teamvibe_session=([^;]+)/)?.[1];
  if (!token) return null;
  return db()
    .prepare(
      "SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires_at>? AND users.archived=0",
    )
    .bind(token, Date.now())
    .first<User>();
}
async function readProject(key: string) {
  const row = await db()
    .prepare("SELECT data FROM projects WHERE id=?")
    .bind(key)
    .first<{ data: string }>();
  if (!row) throw new DomainError("프로젝트를 찾을 수 없습니다.", 404);
  return JSON.parse(row.data) as Project;
}
async function save(previous: Project, p: Project) {
  const result = await db()
    .prepare("UPDATE projects SET data=?,version=? WHERE id=? AND version=?")
    .bind(JSON.stringify(p), p.version, p.id, previous.version)
    .run();
  if (!result.meta.changes)
    throw new DomainError(
      "다른 팀원이 먼저 변경했습니다. 최신 내용을 불러온 뒤 다시 저장해 주세요.",
      409,
    );
}
function assertSameOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  if (!origin) return;
  // Compare hosts only: behind Vercel's proxy req.url may be http while the
  // browser's Origin is https.
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    new URL(req.url).host;
  if (new URL(origin).host !== host)
    throw new DomainError("다른 출처의 요청은 허용하지 않습니다.", 403);
}
async function handle(req: Request) {
  try {
    assertSameOrigin(req);
    const url = new URL(req.url);
    const parts = url.pathname.slice(5).split("/").filter(Boolean);
    if (parts[0] === "health") {
      try {
        await databaseReady();
        return json({
          ok: true,
          mode: "vercel",
          ai: "manual-chatgpt",
          database: "ready",
        });
      } catch {
        return json(
          {
            ok: false,
            mode: "vercel",
            ai: "manual-chatgpt",
            database: "not-ready",
            error: databaseSetupMessage,
          },
          503,
        );
      }
    }
    await seed();
    const user = await identity(req);
    if (req.method === "GET" && parts[0] === "bootstrap") {
      const { results } = await db().prepare("SELECT * FROM users").all<User>();
      let projects: Project[] = [];
      if (user) {
        const rows = await db()
          .prepare("SELECT data FROM projects")
          .all<{ data: string }>();
        projects = rows.results
          .map((row) => JSON.parse(row.data) as Project)
          .filter((p) => p.members.includes(user.id));
      }
      return json({ user, users: results, projects });
    }
    if (req.method === "GET") {
      if (!user) throw new DomainError("시연 프로필을 선택해 주세요.", 401);
      if (parts[0] === "projects" && parts[1]) {
        const p = await readProject(parts[1]);
        if (!p.members.includes(user.id))
          throw new DomainError(
            "프로젝트에 참여한 팀원만 접근할 수 있습니다.",
            403,
          );
        return json(p);
      }
      throw new DomainError("경로를 찾을 수 없습니다.", 404);
    }
    if (req.method !== "POST")
      throw new DomainError("지원하지 않는 요청입니다.", 405);
    if (!req.headers.get("content-type")?.includes("application/json"))
      throw new DomainError("JSON 요청이 필요합니다.", 415);
    const raw = await req.text();
    if (raw.length > 1200000)
      throw new DomainError("요청 크기가 너무 큽니다.", 413);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new DomainError("JSON 형식이 올바르지 않습니다.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new DomainError("JSON 객체가 필요합니다.");
    if (parts[0] === "session") {
      const target = await db()
        .prepare("SELECT * FROM users WHERE id=? AND archived=0")
        .bind(typeof body.userId === "string" ? body.userId : "")
        .first<User>();
      if (!target) throw new DomainError("등록된 시연 프로필을 선택해 주세요.");
      const token = id() + id();
      await db()
        .prepare(
          "INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)",
        )
        .bind(token, target.id, Date.now() + 86400000)
        .run();
      return json({ user: target }, 200, {
        "Set-Cookie": `teamvibe_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`,
      });
    }
    if (parts[0] === "logout")
      return json({ ok: true }, 200, {
        "Set-Cookie":
          "teamvibe_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      });
    if (parts[0] === "users") {
      if (parts[1] === "restore") {
        if (typeof body.userId !== "string")
          throw new DomainError("프로필을 선택하세요.");
        const result = await db()
          .prepare("UPDATE users SET archived=0 WHERE id=? AND archived=1")
          .bind(body.userId)
          .run();
        if (!result.meta.changes)
          throw new DomainError("복원할 프로필을 찾을 수 없습니다.", 404);
        return json({ ok: true });
      }
      if (parts[1] === "archive") {
        if (!user) throw new DomainError("현재 프로필을 선택하세요.", 401);
        const rows = await db()
          .prepare("SELECT data FROM projects")
          .all<{ data: string }>();
        if (
          rows.results.some((row) => {
            const p = JSON.parse(row.data) as Project;
            return !p.deletedAt && p.members.includes(user.id);
          })
        )
          throw new DomainError(
            "참여 중인 프로젝트에서 나가거나 오너 권한을 이전한 후 프로필을 삭제하세요. 프로젝트를 휴지통으로 옮기는 것도 가능합니다.",
          );
        await db()
          .prepare("UPDATE users SET archived=1 WHERE id=?")
          .bind(user.id)
          .run();
        return json({ ok: true }, 200, {
          "Set-Cookie":
            "teamvibe_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        });
      }
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.length > 50 ||
        typeof body.role !== "string" ||
        body.role.length > 80
      )
        throw new DomainError(
          "이름(50자 이내)과 역할(80자 이내)을 입력하세요.",
        );
      if (parts[1] === "edit") {
        if (!user) throw new DomainError("현재 프로필을 선택하세요.", 401);
        await db()
          .prepare("UPDATE users SET name=?,role=? WHERE id=?")
          .bind(body.name.trim(), body.role.trim(), user.id)
          .run();
        return json({
          ...user,
          name: body.name.trim(),
          role: body.role.trim(),
        });
      }
      if (parts[1])
        throw new DomainError("프로필 작업을 찾을 수 없습니다.", 404);
      const u = {
        id: id(),
        name: body.name.trim(),
        role: body.role.trim(),
        color: ["blue", "orange", "purple"][Math.floor(Math.random() * 3)],
      };
      await db()
        .prepare("INSERT INTO users (id,name,role,color) VALUES (?,?,?,?)")
        .bind(u.id, u.name, u.role, u.color)
        .run();
      return json(u, 201);
    }
    if (!user) throw new DomainError("시연 프로필을 선택해 주세요.", 401);
    if (parts[0] === "projects" && !parts[1]) {
      const p = createProject(
        body.name as string,
        body.description as string,
        body.goal as string,
        user.id,
      );
      await db()
        .prepare("INSERT INTO projects (id,version,data) VALUES (?,?,?)")
        .bind(p.id, p.version, JSON.stringify(p))
        .run();
      return json(p, 201);
    }
    if (parts[0] === "join") {
      if (typeof body.code !== "string")
        throw new DomainError("초대 코드를 입력하세요.");
      const rows = await db()
        .prepare("SELECT data FROM projects")
        .all<{ data: string }>();
      const p = rows.results
        .map((r) => JSON.parse(r.data) as Project)
        .find(
          (p) =>
            !p.deletedAt &&
            p.inviteCode.toLowerCase() ===
              String(body.code).trim().toLowerCase(),
        );
      if (!p)
        throw new DomainError("유효한 초대 코드를 찾을 수 없습니다.", 404);
      if (!p.members.includes(user.id)) {
        const next = structuredClone(p);
        next.members.push(user.id);
        next.prd.approvals = [];
        next.stories.forEach((story) => {
          if (story.status === "done") story.status = "review";
        });
        next.version++;
        next.updatedAt = new Date().toISOString();
        next.events.push({
          id: id(),
          at: next.updatedAt,
          actorId: user.id,
          action: "member.join",
          detail: user.name,
        });
        await save(p, next);
        return json(next);
      }
      return json(p);
    }
    if (parts[0] === "projects" && parts[1]) {
      const p = await readProject(parts[1]);
      if (!p.members.includes(user.id))
        throw new DomainError("멤버만 변경할 수 있습니다.", 403);
      if (body.version !== p.version)
        throw new DomainError(
          "다른 팀원이 먼저 변경했습니다. 최신 내용을 불러온 뒤 다시 저장해 주세요.",
          409,
        );
      if (typeof body.type !== "string")
        throw new DomainError("작업 유형이 필요합니다.");
      const next = mutate(p, { ...body, type: body.type }, user.id);
      await save(p, next);
      return json(next);
    }
    throw new DomainError("경로를 찾을 수 없습니다.", 404);
  } catch (error) {
    if (error instanceof DomainError)
      return json({ error: error.message }, error.status);
    if (/no such (?:table|column)|has no column named/i.test(String(error)))
      return json({ error: databaseSetupMessage }, 503);
    console.error("TeamVibe API", error);
    return json(
      {
        error:
          "저장소 처리 중 오류가 발생했습니다. 입력을 보존한 상태로 다시 시도해 주세요.",
      },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
