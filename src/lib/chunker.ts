/**
 * Chunking algorithm for splitting book chapters into readable chunks.
 *
 * Respects paragraph boundaries, prefers chapter boundaries, and preserves
 * inline HTML formatting (em, strong, blockquote, etc.).
 */

export interface ChapterInput {
  title: string;
  html: string;
}

export interface Chunk {
  chapterTitle: string;
  contentHtml: string;
  contentText: string;
  wordCount: number;
}

/**
 * Strip HTML tags from a string and return plain text.
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Count words in a string after stripping any HTML tags.
 * Splits on whitespace and filters out empty tokens.
 */
export function countWords(text: string): number {
  const plain = stripHtml(text);
  if (plain.length === 0) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

/**
 * Extract paragraphs from chapter HTML.
 *
 * Looks for <p>...</p> blocks (with any attributes). If no <p> tags are found,
 * falls back to splitting on double-newline boundaries so that plain-text or
 * non-standard HTML still produces reasonable paragraphs.
 *
 * Inline formatting such as <em>, <strong>, <blockquote>, <a>, <span>, etc.
 * is preserved inside each paragraph.
 */
function extractParagraphs(html: string): string[] {
  // Match <p ...>...</p> blocks (case-insensitive, dotall via [\s\S])
  const pTagRegex = /<p[\s>][\s\S]*?<\/p>/gi;
  const matches = html.match(pTagRegex);

  if (matches && matches.length > 0) {
    return matches
      .map((m) => m.trim())
      .filter((m) => countWords(m) > 0);
  }

  // Fallback: split on double newlines and wrap each block in <p> tags
  const blocks = html
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => countWords(b) > 0);

  return blocks.map((b) => {
    // If the block is already wrapped in a block-level element, keep it as-is
    if (/^<(?:p|div|blockquote|h[1-6])[\s>]/i.test(b)) {
      return b;
    }
    return `<p>${b}</p>`;
  });
}

/**
 * Join an array of paragraph HTML strings and derive the combined HTML,
 * plain text, and word count.
 */
function joinParagraphs(
  paragraphs: string[],
  chapterTitle: string
): Chunk {
  const contentHtml = paragraphs.join("\n");
  const contentText = stripHtml(contentHtml);
  const wordCount = countWords(contentHtml);
  return { chapterTitle, contentHtml, contentText, wordCount };
}

/**
 * Split book chapters into chunks of approximately `targetWords` words.
 *
 * Rules:
 *  - Never split mid-paragraph.
 *  - If adding a paragraph would exceed 120% of targetWords and the buffer
 *    already has content, flush the buffer first.
 *  - At chapter boundaries, flush if the buffer is at least 60% of targetWords.
 *  - Any remaining buffer at the end becomes the final chunk.
 */
export function chunkBook(
  chapters: ChapterInput[],
  targetWords: number
): Chunk[] {
  const chunks: Chunk[] = [];
  let buffer: string[] = [];
  let bufferWordCount = 0;
  let currentChapterTitle = "";

  for (const chapter of chapters) {
    const paragraphs = extractParagraphs(chapter.html);
    currentChapterTitle = chapter.title;

    for (const paragraph of paragraphs) {
      const words = countWords(paragraph);

      if (
        bufferWordCount + words > targetWords * 1.2 &&
        bufferWordCount > 0
      ) {
        // Flush current buffer before starting a new one
        chunks.push(joinParagraphs(buffer, currentChapterTitle));
        buffer = [paragraph];
        bufferWordCount = words;
      } else {
        buffer.push(paragraph);
        bufferWordCount += words;
      }
    }

    // Prefer chapter boundaries as chunk boundaries
    if (bufferWordCount >= targetWords * 0.6) {
      chunks.push(joinParagraphs(buffer, currentChapterTitle));
      buffer = [];
      bufferWordCount = 0;
    }
  }

  // Flush any remaining content
  if (buffer.length > 0) {
    chunks.push(joinParagraphs(buffer, currentChapterTitle));
  }

  return chunks;
}
