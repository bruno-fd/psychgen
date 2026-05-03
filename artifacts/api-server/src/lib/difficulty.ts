import { getEmbeddings } from "./llm";
import { runRScript } from "./r-runner";
import { join } from "node:path";

export interface DifficultyParams {
  algorithm: "glmnet" | "randomForest" | "ensemble";
  crossValidationFolds: number;
  useTextFeatures: boolean;
  useEmbeddingFeatures: boolean;
  embeddingModel: string;
}

export interface DifficultyPrediction {
  itemId: number;
  predicted: number;
  cvR2: number | null;
}

export interface DifficultyResult {
  predictions: DifficultyPrediction[];
  algorithm: string;
  trainSize: number;
  cvR2: number | null;
}

function textFeatures(text: string): Record<string, number> {
  const tokens = text.split(/\s+/).filter(Boolean);
  const chars = text.length;
  const words = tokens.length;
  const sentences = (text.match(/[.!?]+/g) ?? []).length || 1;
  const avgWordLen = words === 0 ? 0 : tokens.reduce((s, t) => s + t.length, 0) / words;
  const longWords = tokens.filter((t) => t.length > 6).length;
  return {
    chars,
    words,
    sentences,
    avgWordLen,
    longWordRatio: words === 0 ? 0 : longWords / words,
    wordsPerSentence: words / sentences,
  };
}

export async function runDifficulty(
  items: { id: number; text: string; difficultyEstimated: number | null }[],
  params: DifficultyParams,
  onProgress?: (p: number, msg: string) => void,
): Promise<DifficultyResult> {
  const calibrated = items.filter((it) => it.difficultyEstimated != null);
  if (calibrated.length < 5) {
    throw new Error(
      `Predição de dificuldade requer pelo menos 5 itens calibrados; recebidos ${calibrated.length}.`,
    );
  }
  if (calibrated.length === items.length) {
    throw new Error("Todos os itens já estão calibrados — nada a predizer.");
  }

  onProgress?.(0.1, "Computando features textuais...");
  const allTexts = items.map((it) => it.text);
  const textFeats = allTexts.map(textFeatures);

  let embeddings: number[][] | null = null;
  if (params.useEmbeddingFeatures) {
    onProgress?.(0.3, `Computando embeddings (${params.embeddingModel})...`);
    embeddings = await getEmbeddings({
      model: params.embeddingModel,
      inputs: allTexts,
    });
  }

  // Build feature matrix: rows = items, cols = features
  const featureMatrix: number[][] = items.map((_, i) => {
    const row: number[] = [];
    if (params.useTextFeatures) {
      const f = textFeats[i]!;
      row.push(f.chars, f.words, f.sentences, f.avgWordLen, f.longWordRatio, f.wordsPerSentence);
    }
    if (embeddings) {
      row.push(...embeddings[i]!);
    }
    return row;
  });

  if (featureMatrix[0]!.length === 0) {
    throw new Error("Nenhuma feature ativada (textFeatures e embeddingFeatures ambos desligados).");
  }

  const trainIdx: number[] = [];
  const predictIdx: number[] = [];
  items.forEach((it, i) => {
    if (it.difficultyEstimated != null) trainIdx.push(i);
    else predictIdx.push(i);
  });

  const trainX = trainIdx.map((i) => featureMatrix[i]!);
  const trainY = trainIdx.map((i) => items[i]!.difficultyEstimated!);
  const predictX = predictIdx.map((i) => featureMatrix[i]!);

  onProgress?.(0.6, `Treinando ${params.algorithm} via R...`);
  const scriptPath = join(process.cwd(), "r-scripts", "stage2_difficulty.R");
  const rResult = await runRScript<{
    predictions: number[];
    cvR2: number | null;
  }>(scriptPath, {
    trainX,
    trainY,
    predictX,
    algorithm: params.algorithm,
    cvFolds: params.crossValidationFolds,
  });

  if (!rResult.ok) {
    throw new Error(`Predição R falhou: ${rResult.error}\n${rResult.stderr.slice(0, 800)}`);
  }

  const predictions: DifficultyPrediction[] = predictIdx.map((idx, k) => ({
    itemId: items[idx]!.id,
    predicted: rResult.result.predictions[k]!,
    cvR2: rResult.result.cvR2,
  }));

  onProgress?.(1, `Predição concluída para ${predictions.length} itens`);
  return {
    predictions,
    algorithm: params.algorithm,
    trainSize: trainIdx.length,
    cvR2: rResult.result.cvR2,
  };
}
