import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  doublePrecision,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const itemsTable = pgTable("items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  construct: varchar("construct", { length: 255 }),
  dimension: varchar("dimension", { length: 255 }),
  status: varchar("status", { length: 32 }).notNull().default("generated"),
  generatedBy: varchar("generated_by", { length: 64 }).notNull(),
  difficultyPredicted: doublePrecision("difficulty_predicted"),
  difficultyEstimated: doublePrecision("difficulty_estimated"),
  discrimination: doublePrecision("discrimination"),
  guessing: doublePrecision("guessing"),
  egaCommunity: integer("ega_community"),
  humanNotes: text("human_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertItemSchema = createInsertSchema(itemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof itemsTable.$inferSelect;
