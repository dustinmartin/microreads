import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface AiConfig {
  endpoint: string;
  model: string;
  apiKey?: string;
}

export async function getAiConfig(): Promise<AiConfig | null> {
  const [endpointRow, modelRow, apiKeyRow] = await Promise.all([
    db.select().from(settings).where(eq(settings.key, "ollama_endpoint")).then((r) => r[0]),
    db.select().from(settings).where(eq(settings.key, "ollama_model")).then((r) => r[0]),
    db.select().from(settings).where(eq(settings.key, "ai_api_key")).then((r) => r[0]),
  ]);

  const endpoint = endpointRow?.value ? JSON.parse(endpointRow.value) : "";
  const model = modelRow?.value ? JSON.parse(modelRow.value) : "";
  if (!endpoint || !model) return null;

  const apiKey = apiKeyRow?.value ? JSON.parse(apiKeyRow.value) : "";

  return { endpoint, model, apiKey: apiKey || undefined };
}

export async function hasAiConfigured(): Promise<boolean> {
  return (await getAiConfig()) !== null;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatCompletion(
  config: AiConfig,
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const maxTokens = options?.maxTokens ?? 16384;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      max_completion_tokens: maxTokens,
    };
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const response = await fetch(`${config.endpoint}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    if (!content || content.trim() === "") {
      throw new Error("AI returned an empty response — the model may need a higher token limit");
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
}
