import { createClient, type Client, type InStatement } from "@libsql/client";

// D1-compatible facade over libsql (Turso remote or local file) so the
// existing route handler keeps its `prepare().bind().first/all/run` calls.
// ponytail: schema is created inline instead of running drizzle migrations;
// switch to `drizzle-kit migrate` if the schema starts changing.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    role text NOT NULL,
    color text NOT NULL,
    archived integer DEFAULT 0 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token text PRIMARY KEY NOT NULL,
    user_id text NOT NULL REFERENCES users(id),
    expires_at integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id text PRIMARY KEY NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    data text NOT NULL
  )`,
];

type Row = Record<string, unknown>;
type Arg = string | number | null;

class Statement {
  constructor(
    private client: Client,
    private sql: string,
    private args: Arg[] = [],
  ) {}
  bind(...args: Arg[]) {
    return new Statement(this.client, this.sql, args);
  }
  toInStatement(): InStatement {
    return { sql: this.sql, args: this.args };
  }
  async first<T = Row>(): Promise<T | null> {
    const { rows } = await this.client.execute(this.toInStatement());
    return (rows[0] as T | undefined) ?? null;
  }
  async all<T = Row>(): Promise<{ results: T[] }> {
    const { rows } = await this.client.execute(this.toInStatement());
    return { results: rows as T[] };
  }
  async run() {
    const { rowsAffected } = await this.client.execute(this.toInStatement());
    return { meta: { changes: rowsAffected } };
  }
}

class Database {
  private ready?: Promise<void>;
  constructor(private client: Client) {}
  prepare(sql: string) {
    return new Statement(this.client, sql);
  }
  async batch(statements: Statement[]) {
    await this.client.batch(
      statements.map((s) => s.toInStatement()),
      "write",
    );
  }
  ensureSchema() {
    this.ready ??= this.client.batch(SCHEMA, "write").then(() => undefined);
    return this.ready;
  }
}

let instance: Database | undefined;

export function getDb() {
  if (!instance) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL is not set.");
    instance = new Database(
      createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN }),
    );
  }
  return instance;
}
