import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { uuid } from "../utils";

export const chatMessages = sqliteTable("chat_messages", {
  id: text().primaryKey().$defaultFn(uuid),
  message: text().notNull(),
  isUser: integer({ mode: "boolean" }).notNull(),
  timestamp: integer().notNull().$defaultFn(Date.now), // epoch millis
  isSystemPrompt: integer({ mode: "boolean" }).notNull().default(false),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
