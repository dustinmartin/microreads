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
  const imageWebRoot = `/api/book-images/${bookId}`;
  const epub = await EPub.createAsync(filePath, imageWebRoot);

  const title = epub.metadata.title ?? "Untitled";
  const author = epub.metadata.creator ?? "Unknown Author";

  // Extract and save cover image
  const coverPath = await extractCover(epub, bookId);

  // Extract and save all images from the epub
  await extractImages(epub, bookId);

  // Extract chapters in spine order
  const chapters = await extractChapters(epub);

  return { title, author, coverPath, chapters };
}

/**
 * Extract all images from the EPUB and save them to data/book-images/{bookId}/.
 * The epub2 library rewrites img src attributes using the imagewebroot we passed,
 * so chapter HTML will reference /api/book-images/{bookId}/{href}.
 */
async function extractImages(epub: EPub, bookId: string): Promise<void> {
  const images = epub.listImage();
  if (!images || images.length === 0) return;

  const baseDir = path.resolve(process.cwd(), "data", "book-images", bookId);

  for (const img of images) {
    if (!img.id) continue;

    try {
      const [imageBuffer] = await epub.getImageAsync(img.id);
      const href = img.href ?? img.id;
      const outputPath = path.join(baseDir, href);

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, imageBuffer);
    } catch {
      // Skip images that fail to extract
    }
  }
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
  // Build a lookup from normalized spine href to TOC title.
  // Keep the first entry per file so the highest-level TOC heading wins.
  const tocTitleMap = new Map<string, string>();
  if (epub.toc) {
    for (const tocItem of epub.toc) {
      if (tocItem.href && tocItem.title) {
        const key = normalizeTocHref(tocItem.href);
        if (!tocTitleMap.has(key)) {
          tocTitleMap.set(key, tocItem.title);
        }
      }
    }
  }

  const chapters: ParsedChapter[] = [];
  let previousTitle = "";

  for (const spineItem of epub.flow) {
    if (!spineItem.id) continue;

    try {
      const html = await epub.getChapterAsync(spineItem.id);

      // Resolve chapter title with fallback chain:
      // 1. epub2 spine item title
      // 2. TOC lookup by normalized href
      // 3. Extract from HTML heading tags
      // 4. Inherit from previous chapter (handles multi-file chapters)
      // 5. "Untitled" as last resort
      let chapterTitle = spineItem.title ?? "";
      if (!chapterTitle && spineItem.href) {
        const key = normalizeTocHref(spineItem.href);
        chapterTitle = tocTitleMap.get(key) ?? "";
      }
      if (!chapterTitle) {
        const htmlTitle = extractTitleFromHtml(html);
        if (htmlTitle) {
          // If the HTML heading is a substring of the previous title,
          // this spine item is likely a continuation of the same chapter
          // (e.g., TOC says "Chapter 1: Hadrian", HTML just has <h1>Hadrian</h1>)
          if (
            previousTitle &&
            htmlTitle.length >= 3 &&
            previousTitle.toLowerCase().includes(htmlTitle.toLowerCase())
          ) {
            chapterTitle = previousTitle;
          } else {
            chapterTitle = htmlTitle;
          }
        }
      }
      if (!chapterTitle && previousTitle) {
        chapterTitle = previousTitle;
      }
      if (!chapterTitle) {
        chapterTitle = "Untitled";
      }

      previousTitle = chapterTitle;

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

  // Merge consecutive chapters with the same title into a single entry.
  // Multi-file chapters (common in EPUBs) should be treated as one chapter
  // so the chunker doesn't force-flush at arbitrary XHTML file boundaries.
  const merged: ParsedChapter[] = [];
  for (const ch of chapters) {
    const prev = merged[merged.length - 1];
    if (prev && prev.title === ch.title) {
      prev.html += "\n" + ch.html;
    } else {
      merged.push({ ...ch });
    }
  }

  return merged;
}

/**
 * Normalize a TOC href for consistent lookup — strips fragments, decodes
 * URL-encoding, normalizes slashes, and lowercases.
 */
function normalizeTocHref(href: string): string {
  let base = href.split("#")[0];
  try { base = decodeURIComponent(base); } catch {}
  return base.replace(/\\/g, "/").replace(/^\/+/, "").trim().toLowerCase();
}

/**
 * Try to extract a title from HTML heading tags (h1, h2, h3).
 * Returns the first heading's text content, or empty string if none found.
 */
function extractTitleFromHtml(html: string): string {
  for (const tag of ["h1", "h2", "h3"]) {
    const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (match) {
      const text = match[1].replace(/<[^>]*>/g, "").trim();
      if (text.length > 0 && text.length <= 200) return text;
    }
  }
  return "";
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
