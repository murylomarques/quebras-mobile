import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// TODO: Add your tables here

export const breakAudits = mysqlTable("break_audits", {
  id: varchar("id", { length: 36 }).primaryKey(),
  serviceAppointmentId: varchar("serviceAppointmentId", { length: 64 }).notNull(),
  technicianCsso: varchar("technicianCsso", { length: 64 }).notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  evidenceUrl: text("evidenceUrl").notNull(),
  evidenceKey: text("evidenceKey"),
  latitude: varchar("latitude", { length: 64 }),
  longitude: varchar("longitude", { length: 64 }),
  capturedAt: varchar("capturedAt", { length: 64 }),
  imageWidth: int("imageWidth"),
  imageHeight: int("imageHeight"),
  imageOrientation: varchar("imageOrientation", { length: 32 }),
  exifTimestamp: varchar("exifTimestamp", { length: 64 }),
  exifGpsLat: varchar("exifGpsLat", { length: 64 }),
  exifGpsLng: varchar("exifGpsLng", { length: 64 }),
  status: varchar("status", { length: 32 }).default("completed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BreakAudit = typeof breakAudits.$inferSelect;
export type InsertBreakAudit = typeof breakAudits.$inferInsert;
