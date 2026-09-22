import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  color: text("color").notNull(),
  archived: integer("archived").notNull().default(0),
});
export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
});
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  version: integer("version").notNull().default(1),
  data: text("data").notNull(),
});
