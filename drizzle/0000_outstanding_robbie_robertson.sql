CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`cover_image` text,
	`epub_path` text NOT NULL,
	`chunk_size_words` integer DEFAULT 1000 NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`total_chunks` integer DEFAULT 0 NOT NULL,
	`current_chunk_index` integer DEFAULT 0 NOT NULL,
	`added_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`index` integer NOT NULL,
	`chapter_title` text,
	`content_html` text NOT NULL,
	`content_text` text NOT NULL,
	`word_count` integer NOT NULL,
	`ai_recap` text,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reading_log` (
	`id` text PRIMARY KEY NOT NULL,
	`chunk_id` text NOT NULL,
	`book_id` text NOT NULL,
	`sent_at` text,
	`read_at` text,
	`read_via` text,
	FOREIGN KEY (`chunk_id`) REFERENCES `chunks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
