import EPub from "epub2";
import fs from "node:fs";
import path from "node:path";

export interface ParsedChapter {
  title: string;
  html: string;
}

export interface ParsedEpub {
  title: string;
  author: string;
  coverPath: string | null;
  chapters: ParsedChapter[];
}

/**
 * Parse an EPUB file and extract metadata, cover image, and chapter content.
 *
 * @param filePath - Absolute path to the .epub file
 * @param bookId - Unique book identifier, used for naming the cover image
 * @returns Parsed EPUB data including title, author, cover path, and chapters
 */
export async function parseEpub(
  filePath: string,
  bookId: string
): Promise<ParsedEpub> {
  const epub = await EPub.createAsync(filePath);

  const title = epub.metadata.title ?? "Untitled";
  const author = epub.metadata.creator ?? "Unknown Author";

  // Extract and save cover image
  const coverPath = await extractCover(epub, bookId);

  // Extract chapters in spine order
  const chapters = await extractChapters(epub);

  return { title, author, coverPath, chapters };
}

/**
 * Attempts to extract the cover image from the EPUB and save it to disk.
 * Returns the relative path to the saved cover, or null if no cover was found.
 */
async function extractCover(
  epub: EPub,
  bookId: string
): Promise<string | null> {
  const coverId = epub.metadata.cover;
  if (!coverId) {
    return null;
  }

  try {
    const [imageBuffer, mimeType] = await epub.getImageAsync(coverId);

    // Determine file extension from mime type
    const ext = extensionFromMime(mimeType);

    // Ensure covers directory exists
    const coversDir = path.resolve(process.cwd(), "covers");
    fs.mkdirSync(coversDir, { recursive: true });

    const filename = `${bookId}${ext}`;
    const outputPath = path.join(coversDir, filename);
    fs.writeFileSync(outputPath, imageBuffer);

    return `covers/${filename}`;
  } catch {
    // Cover extraction can fail for various reasons (missing file in zip, etc.)
    return null;
  }
}

/**
 * Extract all chapters from the EPUB spine in reading order.
 * Each spine item's HTML content is fetched, and the chapter title is resolved
 * from the table of contents when available.
 */
async function extractChapters(epub: EPub): Promise<ParsedChapter[]> {
  // Build a lookup from spine href to TOC title
  const tocTitleMap = new Map<string, string>();
  if (epub.toc) {
    for (const tocItem of epub.toc) {
      if (tocItem.href && tocItem.title) {
        // TOC hrefs may include fragment identifiers — strip them for matching
        const hrefBase = tocItem.href.split("#")[0];
        tocTitleMap.set(hrefBase, tocItem.title);
      }
    }
  }

  const chapters: ParsedChapter[] = [];

  for (const spineItem of epub.flow) {
    if (!spineItem.id) continue;

    try {
      const html = await epub.getChapterAsync(spineItem.id);

      // Resolve chapter title: try TOC first, fall back to spine item title or id
      let chapterTitle = spineItem.title ?? "";
      if (!chapterTitle && spineItem.href) {
        const hrefBase = spineItem.href.split("#")[0];
        chapterTitle = tocTitleMap.get(hrefBase) ?? "";
      }
      if (!chapterTitle) {
        chapterTitle = spineItem.id;
      }

      chapters.push({
        title: chapterTitle,
        html,
      });
    } catch {
      // Some spine items may not be valid XHTML chapters (e.g., images).
      // Skip them silently.
      continue;
    }
  }

  return chapters;
}

/**
 * Map a MIME type to a file extension.
 */
function extensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
  };
  return map[mimeType] ?? ".jpg";
}
