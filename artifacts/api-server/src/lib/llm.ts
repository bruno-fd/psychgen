import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropic } from "@workspace/integrations-anthropic-ai";

export const ANTHROPIC_MODEL_ALIASES: Record<string, string> = {
  "claude-haiku-4-5": "claude-haiku-4-5",
  "claude-sonnet-4-5": "claude-sonnet-4-5",
  "claude-opus-4": "claude-opus-4-1",
};

export function isAnthropicModel(model: string): boolean {
  return model.toLowerCase().includes("claude");
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatComplete(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}): Promise<string> {
  if (isAnthropicModel(opts.model)) {
    const system = opts.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const userMessages = opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    const resolvedModel = ANTHROPIC_MODEL_ALIASES[opts.model] ?? opts.model;
    const resp = await anthropic.messages.create({
      model: resolvedModel,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature,
      top_p: opts.topP,
      ...(system ? { system } : {}),
      messages: userMessages,
    });
    const textBlock = resp.content.find((b) => b.type === "text");
    return textBlock && textBlock.type === "text" ? textBlock.text : "";
  }

  const resp = await openai.chat.completions.create({
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature,
    top_p: opts.topP,
    max_tokens: opts.maxTokens,
  });
  return resp.choices[0]?.message?.content ?? "";
}

export async function getEmbeddings(opts: {
  model: string;
  inputs: string[];
}): Promise<number[][]> {
  const resp = await openai.embeddings.create({
    model: opts.model,
    input: opts.inputs,
  });
  return resp.data.map((d) => d.embedding);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
