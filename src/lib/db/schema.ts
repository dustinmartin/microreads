import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const books = sqliteTable("books", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  coverImage: text("cover_image"),
  epubPath: text("epub_path").notNull(),
  chunkSizeWords: integer("chunk_size_words").notNull().default(1000),
  status: text("status", {
    enum: ["active", "paused", "completed", "queued"],
  })
    .notNull()
    .default("queued"),
  totalChunks: integer("total_chunks").notNull().default(0),
  currentChunkIndex: integer("current_chunk_index").notNull().default(0),
  addedAt: text("added_at").notNull(),
  completedAt: text("completed_at"),
});

export const chunks = sqliteTable("chunks", {
  id: text("id").primaryKey(),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  chapterTitle: text("chapter_title"),
  contentHtml: text("content_html").notNull(),
  contentText: text("content_text").notNull(),
  wordCount: integer("word_count").notNull(),
  aiRecap: text("ai_recap"),
});

export const readingLog = sqliteTable("reading_log", {
  id: text("id").primaryKey(),
  chunkId: text("chunk_id")
    .notNull()
    .references(() => chunks.id, { onDelete: "cascade" }),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  sentAt: text("sent_at"),
  readAt: text("read_at"),
  readVia: text("read_via", {
    enum: ["email_link", "web_app", "manual_trigger"],
  }),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
