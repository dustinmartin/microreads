import { db } from "@/lib/db";
import { settings, audioCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
}

export async function getElevenLabsConfig(): Promise<ElevenLabsConfig | null> {
  const [apiKeyRow, voiceIdRow] = await Promise.all([
    db.select().from(settings).where(eq(settings.key, "elevenlabs_api_key")).then((r) => r[0]),
    db.select().from(settings).where(eq(settings.key, "elevenlabs_voice_id")).then((r) => r[0]),
  ]);

  const apiKey = apiKeyRow?.value ? JSON.parse(apiKeyRow.value) : "";
  if (!apiKey) return null;

  const voiceId = voiceIdRow?.value ? JSON.parse(voiceIdRow.value) : "21m00Tcm4TlvDq8ikWAM";

  return { apiKey, voiceId: voiceId || "21m00Tcm4TlvDq8ikWAM" };
}

export async function generateSpeechStream(
  text: string,
  config: ElevenLabsConfig
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.5 },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`);
  }

  if (!response.body) {
    throw new Error("ElevenLabs returned empty response body");
  }

  return response.body as ReadableStream<Uint8Array>;
}

interface OpenAiTtsConfig {
  apiKey: string;
}

export async function getOpenAiTtsConfig(): Promise<OpenAiTtsConfig | null> {
  const [apiKeyRow] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "openai_tts_api_key"));

  const apiKey = apiKeyRow?.value ? JSON.parse(apiKeyRow.value) : "";
  if (!apiKey) return null;

  return { apiKey };
}

export async function generateOpenAiSpeechStream(
  text: string,
  config: OpenAiTtsConfig
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "alloy",
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI TTS API error ${response.status}: ${errorText}`);
  }

  if (!response.body) {
    throw new Error("OpenAI TTS returned empty response body");
  }

  return response.body as ReadableStream<Uint8Array>;
}

export async function hasTtsConfigured(): Promise<boolean> {
  const [elevenLabs, openAi] = await Promise.all([
    getElevenLabsConfig(),
    getOpenAiTtsConfig(),
  ]);
  return elevenLabs !== null || openAi !== null;
}

export async function generateSpeechWithFallback(
  text: string
): Promise<{ stream: ReadableStream<Uint8Array>; voiceId: string }> {
  // Try ElevenLabs first
  const elevenLabsConfig = await getElevenLabsConfig();
  if (elevenLabsConfig) {
    try {
      const stream = await generateSpeechStream(text, elevenLabsConfig);
      return { stream, voiceId: elevenLabsConfig.voiceId };
    } catch (err) {
      console.warn("ElevenLabs TTS failed, trying OpenAI fallback:", err);
    }
  }

  // Try OpenAI TTS as fallback
  const openAiConfig = await getOpenAiTtsConfig();
  if (openAiConfig) {
    const stream = await generateOpenAiSpeechStream(text, openAiConfig);
    return { stream, voiceId: "openai-alloy" };
  }

  throw new Error("No TTS provider configured or available");
}

export async function deleteBookAudioFiles(bookId: string): Promise<void> {
  const rows = await db.select().from(audioCache).where(eq(audioCache.bookId, bookId));

  for (const row of rows) {
    try {
      fs.unlinkSync(path.resolve(process.cwd(), row.filePath));
    } catch {
      // Silently ignore file deletion errors
    }
  }

  await db.delete(audioCache).where(eq(audioCache.bookId, bookId));
}
