import { chatComplete, getEmbeddings, cosineSimilarity } from "./llm";
import { logger } from "./logger";

export interface AigenieParams {
  model: string;
  temperature: number;
  topP: number;
  targetN: number;
  adaptive: boolean;
  allTogether: boolean;
  runOverall: boolean;
  systemRole?: string | null;
  promptNotes?: string | null;
  itemAttributes?: string[];
  itemExamples?: string[];
  embeddingModel: string;
  egaThreshold: number;
}

export interface GeneratedItem {
  text: string;
  community: number | null;
  embedding: number[];
}

export interface AigenieResult {
  items: GeneratedItem[];
  rounds: number;
  rejected: number;
}

const DEFAULT_SYSTEM_ROLE_PT = `Você é um especialista em psicometria, com profunda experiência em construção de instrumentos psicológicos para o mercado editorial brasileiro (Hogrefe, Vetor, Casa do Psicólogo). Você redige itens em português brasileiro, claros, sem ambiguidade, com vocabulário acessível e psicometricamente bem formulados.`;

function buildSystemPrompt(p: AigenieParams, construct: string): string {
  const roleBase = p.systemRole?.trim() || DEFAULT_SYSTEM_ROLE_PT;
  const attrs =
    p.itemAttributes && p.itemAttributes.length > 0
      ? `\n\nCada item DEVE atender aos seguintes atributos:\n- ${p.itemAttributes.join("\n- ")}`
      : "";
  const examples =
    p.itemExamples && p.itemExamples.length > 0
      ? `\n\nExemplos de itens bem formulados (não copiar literalmente):\n- ${p.itemExamples.join("\n- ")}`
      : "";
  const notes = p.promptNotes ? `\n\nObservações adicionais:\n${p.promptNotes}` : "";

  return `${roleBase}

Tarefa: gerar itens para o construto "${construct}".${attrs}${examples}${notes}

Diretrizes de redação:
- Idioma: português brasileiro.
- Use 1ª pessoa do singular quando apropriado para escalas autorrelato.
- Evite duplas negações.
- Evite jargão técnico desnecessário.
- Cada item deve ter entre 8 e 30 palavras.

Responda APENAS com os itens, um por linha, sem numeração, sem explicações, sem cabeçalhos.`;
}

function parseItems(text: string): string[] {
  return text
    .split(/\r?\n+/)
    .map((line) => line.replace(/^[-*0-9.)\s]+/, "").trim())
    .filter((line) => line.length >= 5 && line.length <= 400);
}

/**
 * Stage 1 — AIGENIE-style generation with embedding-based community check.
 *
 * Generates items in batches via the chosen LLM, embeds them, and clusters
 * them by cosine similarity. Items whose max neighbor similarity falls below
 * `egaThreshold` are rejected (don't fit any community).
 */
export async function runAigenie(
  construct: string,
  params: AigenieParams,
  onProgress?: (p: number, msg: string) => void,
): Promise<AigenieResult> {
  const system = buildSystemPrompt(params, construct);
  const accepted: GeneratedItem[] = [];
  let rejected = 0;
  let rounds = 0;
  const maxRounds = params.adaptive ? 8 : 1;
  const batchSize = params.allTogether
    ? params.targetN
    : Math.max(5, Math.ceil(params.targetN / 4));

  while (accepted.length < params.targetN && rounds < maxRounds) {
    rounds++;
    const need = params.targetN - accepted.length;
    const requestN = Math.min(batchSize, need * 2);
    onProgress?.(
      Math.min(0.95, accepted.length / params.targetN),
      `Rodada ${rounds}: solicitando ${requestN} itens via ${params.model}`,
    );

    const userPrompt = `Gere ${requestN} itens distintos e diversos para medir o construto "${construct}". Não repita ideias. Cubra diferentes facetas do construto.`;
    let raw = "";
    try {
      raw = await chatComplete({
        model: params.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        temperature: params.temperature,
        topP: params.topP,
        maxTokens: Math.min(4000, requestN * 80),
      });
    } catch (err) {
      logger.error({ err, model: params.model }, "AIGENIE LLM call failed");
      throw err;
    }

    const candidates = parseItems(raw);
    if (candidates.length === 0) {
      logger.warn({ rounds, raw: raw.slice(0, 300) }, "No items parsed");
      continue;
    }

    let embeddings: number[][];
    try {
      embeddings = await getEmbeddings({
        model: params.embeddingModel,
        inputs: candidates,
      });
    } catch (err) {
      logger.error({ err }, "Embedding call failed");
      throw err;
    }

    for (let i = 0; i < candidates.length; i++) {
      const text = candidates[i]!;
      const emb = embeddings[i]!;
      // Skip near-duplicates of already accepted
      const dupSim = accepted.reduce(
        (max, a) => Math.max(max, cosineSimilarity(emb, a.embedding)),
        0,
      );
      if (dupSim > 0.95) {
        rejected++;
        continue;
      }
      accepted.push({ text, community: null, embedding: emb });
      if (accepted.length >= params.targetN) break;
    }
  }

  // Final EGA-style community detection: simple connected-components on
  // cosine-similarity > threshold.
  if (accepted.length > 1 && params.runOverall) {
    const n = accepted.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => {
      while (parent[x]! !== x) {
        parent[x] = parent[parent[x]!]!;
        x = parent[x]!;
      }
      return x;
    };
    const union = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const sim = cosineSimilarity(
          accepted[i]!.embedding,
          accepted[j]!.embedding,
        );
        if (sim >= params.egaThreshold) union(i, j);
      }
    }
    const roots = new Map<number, number>();
    accepted.forEach((it, i) => {
      const r = find(i);
      if (!roots.has(r)) roots.set(r, roots.size);
      it.community = roots.get(r)!;
    });
  }

  onProgress?.(1, `Concluído: ${accepted.length} itens em ${rounds} rodadas`);
  return { items: accepted, rounds, rejected };
}
