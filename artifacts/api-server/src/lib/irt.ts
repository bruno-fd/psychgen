import { chatComplete } from "./llm";
import { runRScript } from "./r-runner";
import { logger } from "./logger";
import { join } from "node:path";

export interface IrtParams {
  models: string[];
  syntheticN: number;
  irtModel: "Rasch" | "2PL" | "3PL" | "graded";
  personaSeed?: string | null;
  temperature: number;
  responseFormat: "likert5" | "likert7" | "dichotomous";
}

export interface IrtCalibration {
  itemId: number;
  difficulty: number;
  discrimination: number;
  guessing: number | null;
}

export interface IrtRunResult {
  calibrations: IrtCalibration[];
  reliability: number;
  responsesGenerated: number;
  modelFit: Record<string, number>;
}

const DEFAULT_PERSONA_SEED_PT = `Você gerará personas brasileiras realistas para um estudo psicométrico. Cada persona deve incluir: idade, gênero, escolaridade, ocupação, traços de personalidade dominantes, e histórico psicológico relevante.`;

async function generatePersonas(
  params: IrtParams,
  n: number,
): Promise<string[]> {
  const seed = params.personaSeed?.trim() || DEFAULT_PERSONA_SEED_PT;
  const personas: string[] = [];
  const batchSize = 25;
  for (let i = 0; i < n; i += batchSize) {
    const k = Math.min(batchSize, n - i);
    const txt = await chatComplete({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: seed },
        {
          role: "user",
          content: `Gere ${k} personas distintas, uma por linha, no formato compacto: "Idade X, Gênero, Escolaridade, Ocupação, traços principais (3-4 palavras), histórico breve". Sem numeração.`,
        },
      ],
      temperature: 1.1,
      maxTokens: k * 80,
    });
    txt
      .split(/\r?\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20)
      .slice(0, k)
      .forEach((p) => personas.push(p));
  }
  return personas.slice(0, n);
}

function scaleInfo(format: IrtParams["responseFormat"]): {
  min: number;
  max: number;
  description: string;
} {
  switch (format) {
    case "likert7":
      return {
        min: 1,
        max: 7,
        description:
          "uma escala Likert de 7 pontos: 1=Discordo totalmente, 4=Neutro, 7=Concordo totalmente",
      };
    case "dichotomous":
      return {
        min: 0,
        max: 1,
        description: "0=Falso/Não me descreve, 1=Verdadeiro/Me descreve",
      };
    case "likert5":
    default:
      return {
        min: 1,
        max: 5,
        description:
          "uma escala Likert de 5 pontos: 1=Discordo totalmente, 3=Neutro, 5=Concordo totalmente",
      };
  }
}

function parseResponses(
  raw: string,
  numItems: number,
  min: number,
  max: number,
): number[] {
  const nums = raw.match(/-?\d+/g) ?? [];
  const responses: number[] = [];
  for (const n of nums) {
    const v = parseInt(n, 10);
    if (!Number.isNaN(v) && v >= min && v <= max) {
      responses.push(v);
      if (responses.length >= numItems) break;
    }
  }
  while (responses.length < numItems) {
    responses.push(Math.round((min + max) / 2));
  }
  return responses;
}

export async function runIrt(
  itemTexts: { id: number; text: string }[],
  construct: string,
  params: IrtParams,
  onProgress?: (p: number, msg: string) => void,
): Promise<IrtRunResult> {
  if (itemTexts.length < 2) {
    throw new Error("IRT requer pelo menos 2 itens.");
  }
  if (params.models.length === 0) {
    throw new Error("Pelo menos um modelo LLM é necessário.");
  }

  const scale = scaleInfo(params.responseFormat);
  const itemList = itemTexts
    .map((it, i) => `${i + 1}. ${it.text}`)
    .join("\n");

  onProgress?.(0.05, `Gerando ${params.syntheticN} personas sintéticas...`);
  const personas = await generatePersonas(params, params.syntheticN);

  // Distribute personas across the LLM ensemble round-robin
  const responseMatrix: number[][] = [];
  let completed = 0;
  for (let i = 0; i < personas.length; i++) {
    const persona = personas[i]!;
    const model = params.models[i % params.models.length]!;
    const userPrompt = `Você responderá um questionário sobre "${construct}" como se fosse esta pessoa:

PERSONA: ${persona}

Para cada item abaixo, responda com um número em ${scale.description}.

ITENS:
${itemList}

Responda APENAS com os ${itemTexts.length} números, separados por vírgula, na ordem dos itens. Sem explicações.`;
    try {
      const raw = await chatComplete({
        model,
        messages: [
          {
            role: "system",
            content: `Você está realizando uma simulação psicométrica acadêmica. Responda em personagem como a persona descrita.`,
          },
          { role: "user", content: userPrompt },
        ],
        temperature: params.temperature,
        maxTokens: itemTexts.length * 8 + 50,
      });
      const responses = parseResponses(raw, itemTexts.length, scale.min, scale.max);
      responseMatrix.push(responses);
    } catch (err) {
      logger.warn({ err, model, persona: persona.slice(0, 60) }, "Persona response failed");
    }
    completed++;
    if (completed % 25 === 0 || completed === personas.length) {
      onProgress?.(
        0.05 + 0.75 * (completed / personas.length),
        `${completed}/${personas.length} respostas sintéticas coletadas`,
      );
    }
  }

  if (responseMatrix.length < 10) {
    throw new Error(`Apenas ${responseMatrix.length} respostas válidas coletadas; insuficiente para calibração.`);
  }

  onProgress?.(0.85, `Calibrando modelo IRT (${params.irtModel}) via mirt...`);
  const scriptPath = join(process.cwd(), "r-scripts", "stage3_irt.R");
  const rResult = await runRScript<{
    calibrations: { difficulty: number; discrimination: number; guessing: number | null }[];
    reliability: number;
    modelFit: Record<string, number>;
  }>(scriptPath, {
    responses: responseMatrix,
    irtModel: params.irtModel,
    responseFormat: params.responseFormat,
  });

  if (!rResult.ok) {
    throw new Error(`Calibração R falhou: ${rResult.error}\n${rResult.stderr.slice(0, 800)}`);
  }

  const calibrations: IrtCalibration[] = rResult.result.calibrations.map((c, i) => ({
    itemId: itemTexts[i]!.id,
    difficulty: c.difficulty,
    discrimination: c.discrimination,
    guessing: c.guessing,
  }));

  onProgress?.(1, `Calibração concluída — confiabilidade ${rResult.result.reliability.toFixed(3)}`);

  return {
    calibrations,
    reliability: rResult.result.reliability,
    responsesGenerated: responseMatrix.length,
    modelFit: rResult.result.modelFit,
  };
}
