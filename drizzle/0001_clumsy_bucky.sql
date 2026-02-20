CREATE TABLE `audio_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`chunk_id` text NOT NULL,
	`book_id` text NOT NULL,
	`file_path` text NOT NULL,
	`voice_id` text NOT NULL,
	`file_size_bytes` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`chunk_id`) REFERENCES `chunks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audio_cache_chunk_id_unique` ON `audio_cache` (`chunk_id`);