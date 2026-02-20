import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chunks, audioCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hasTtsConfigured, generateSpeechWithFallback } from "@/lib/elevenlabs";
import { verifyChunkToken } from "@/lib/tokens";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

async function isSessionValid(request: NextRequest): Promise<boolean> {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) return true;
  const session = request.cookies.get("session")?.value;
  if (!session) return false;
  const { createHmac } = await import("crypto");
  const hmac = createHmac("sha256", authSecret);
  hmac.update("authenticated");
  return session === hmac.digest("hex");
}

async function writeToDisk(
  stream: ReadableStream<Uint8Array>,
  filePath: string
): Promise<number> {
  const writeStream = fs.createWriteStream(filePath);
  let totalBytes = 0;

  try {
    const reader = stream.getReader();
    await new Promise<void>((resolve, reject) => {
      const pump = () => {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              writeStream.end();
              resolve();
              return;
            }
            totalBytes += value.byteLength;
            const canContinue = writeStream.write(value);
            if (canContinue) {
              pump();
            } else {
              writeStream.once("drain", pump);
            }
          })
          .catch(reject);
      };
      writeStream.on("error", reject);
      pump();
    });
  } catch (err) {
    writeStream.destroy();
    // Clean up partial file on error
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }

  return totalBytes;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth: check session cookie or token
  const token = request.nextUrl.searchParams.get("token") ?? undefined;
  const sessionValid = await isSessionValid(request);
  const tokenValid = token ? verifyChunkToken(token, id) : false;

  if (!sessionValid && !tokenValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up chunk
  const [chunk] = await db.select().from(chunks).where(eq(chunks.id, id));
  if (!chunk) {
    return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
  }

  // Check if any TTS provider is configured
  const ttsAvailable = await hasTtsConfigured();
  if (!ttsAvailable) {
    return NextResponse.json(
      { error: "No TTS provider configured" },
      { status: 503 }
    );
  }

  // Check audio cache
  const [cached] = await db
    .select()
    .from(audioCache)
    .where(eq(audioCache.chunkId, id));

  if (cached) {
    const absolutePath = path.resolve(process.cwd(), cached.filePath);
    if (fs.existsSync(absolutePath)) {
      // Serve cached file
      const fileBuffer = fs.readFileSync(absolutePath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(fileBuffer.byteLength),
          "Cache-Control": "private, max-age=86400",
        },
      });
    } else {
      // Stale DB record — delete it
      await db.delete(audioCache).where(eq(audioCache.chunkId, id));
    }
  }

  // Generate new audio
  const audioDir = path.join(process.cwd(), "data", "audio");
  fs.mkdirSync(audioDir, { recursive: true });

  const filePath = path.join("data", "audio", `${id}.mp3`);
  const absoluteFilePath = path.resolve(process.cwd(), filePath);

  let result: { stream: ReadableStream<Uint8Array>; voiceId: string };
  try {
    result = await generateSpeechWithFallback(chunk.contentText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("TTS generation failed:", message);
    return NextResponse.json(
      { error: "TTS generation failed", detail: message },
      { status: 502 }
    );
  }

  const [clientStream, diskStream] = result.stream.tee();

  // Write to disk in the background, then insert cache record
  (async () => {
    try {
      const fileSizeBytes = await writeToDisk(diskStream, absoluteFilePath);
      await db.insert(audioCache).values({
        id: crypto.randomUUID(),
        chunkId: id,
        bookId: chunk.bookId,
        filePath,
        voiceId: result.voiceId,
        fileSizeBytes,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Audio background write failed:", err);
      // Clean up partial file if it was created
      try {
        if (fs.existsSync(absoluteFilePath)) {
          fs.unlinkSync(absoluteFilePath);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  })();

  return new NextResponse(clientStream, {
    headers: {
      "Content-Type": "audio/mpeg",
    },
  });
}

export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [cached] = await db
    .select()
    .from(audioCache)
    .where(eq(audioCache.chunkId, id));

  if (cached) {
    const absolutePath = path.resolve(process.cwd(), cached.filePath);
    if (fs.existsSync(absolutePath)) {
      return new NextResponse(null, { status: 200 });
    }
  }

  return new NextResponse(null, { status: 404 });
}
