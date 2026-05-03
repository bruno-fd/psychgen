import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  doublePrecision,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const pipelineJobsTable = pgTable("pipeline_jobs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  stage: varchar("stage", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("queued"),
  progress: doublePrecision("progress").notNull().default(0),
  message: text("message"),
  paramsJson: jsonb("params_json").notNull().default({}),
  resultJson: jsonb("result_json"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPipelineJobSchema = createInsertSchema(pipelineJobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPipelineJob = z.infer<typeof insertPipelineJobSchema>;
export type PipelineJob = typeof pipelineJobsTable.$inferSelect;
