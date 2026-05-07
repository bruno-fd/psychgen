/**
 * R script preview generator — backend is the source of truth for the
 * R syntax shown in the UI's read-only editor and downloaded as `.R`.
 *
 * Each function returns an executable R script equivalent to running the
 * corresponding stage with the given parameters. The script reads/writes
 * to R_INPUT_JSON / R_OUTPUT_JSON exactly like the runtime path, so the
 * user can `Rscript thefile.R` outside the app and reproduce the run.
 */
export type Stage = "aigenie" | "difficulty" | "irt" | "sample_design";

export interface AigenieParams {
  model: string;
  temperature: number;
  topP: number;
  targetN: number;
  adaptive: boolean;
  allTogether: boolean;
  runOverall: boolean;
  systemRole?: string;
  promptNotes?: string;
  itemAttributes?: string[];
  itemExamples?: string[];
  embeddingModel: string;
  egaThreshold: number;
}

export interface DifficultyParams {
  algorithm: "glmnet" | "randomForest" | "ensemble";
  useTextFeatures: boolean;
  useEmbeddingFeatures: boolean;
  embeddingModel: string;
  crossValidationFolds: number;
}

export interface IrtParams {
  irtModel: "Rasch" | "2PL" | "3PL" | "graded";
  responseFormat: "likert5" | "likert7" | "dichotomous";
  models: string[];
  syntheticN: number;
  temperature: number;
  personaSeed?: string;
}

export interface SampleDesignParams {
  targetSampleN: number;
  targetThetaSE?: number;
  shortlistMaxItems?: number;
  strata: { label: string; populationShare: number; sampledN?: number | null }[];
}

const HEADER = `# ============================================================================
# Gerado automaticamente pelo PsychGen BR — fonte da verdade no backend.
# Reproduza fora do app:
#   export R_INPUT_JSON=input.json
#   export R_OUTPUT_JSON=output.json
#   Rscript este_arquivo.R
# ============================================================================
source(file.path(getwd(), "r-scripts", "_common.R"))
`;

function rString(s: string | undefined | null): string {
  if (s == null) return "NULL";
  return JSON.stringify(s);
}
function rBool(b: boolean): string {
  return b ? "TRUE" : "FALSE";
}
function rNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "NULL";
  return String(n);
}
function rCharVec(arr: string[] | undefined | null): string {
  if (!arr || arr.length === 0) return "character(0)";
  return `c(${arr.map((s) => JSON.stringify(s)).join(", ")})`;
}

export function generateAigenieScript(opts: {
  construct: string;
  params: AigenieParams;
}): string {
  const p = opts.params;
  return `${HEADER}
# --- Parâmetros vindos do formulário ----------------------------------------
construct <- ${rString(opts.construct)}
params <- list(
  model            = ${rString(p.model)},
  temperature      = ${rNum(p.temperature)},
  topP             = ${rNum(p.topP)},
  targetN          = ${rNum(p.targetN)},
  adaptive         = ${rBool(p.adaptive)},
  allTogether      = ${rBool(p.allTogether)},
  runOverall       = ${rBool(p.runOverall)},
  systemRole       = ${rString(p.systemRole || "")},
  promptNotes      = ${rString(p.promptNotes || "")},
  itemAttributes   = ${rCharVec(p.itemAttributes)},
  itemExamples     = ${rCharVec(p.itemExamples)},
  embeddingModel   = ${rString(p.embeddingModel)},
  egaThreshold     = ${rNum(p.egaThreshold)}
)

# --- Persiste a entrada e delega ao stage1_aigenie.R ------------------------
input_path <- Sys.getenv("R_INPUT_JSON", unset = tempfile(fileext = ".json"))
writeLines(jsonlite::toJSON(list(construct = construct, params = params),
                             auto_unbox = TRUE), input_path)
Sys.setenv(R_INPUT_JSON = input_path)

source(file.path(getwd(), "r-scripts", "stage1_aigenie.R"))
`;
}

export function generateDifficultyScript(opts: { params: DifficultyParams }): string {
  const p = opts.params;
  return `${HEADER}
# --- Parâmetros vindos do formulário ----------------------------------------
params <- list(
  algorithm            = ${rString(p.algorithm)},
  useTextFeatures      = ${rBool(p.useTextFeatures)},
  useEmbeddingFeatures = ${rBool(p.useEmbeddingFeatures)},
  embeddingModel       = ${rString(p.embeddingModel)},
  crossValidationFolds = ${rNum(p.crossValidationFolds)}
)

# Os itens são carregados em runtime pelo backend (com base no projeto).
# Ao reproduzir manualmente, monte um JSON com:
#   { items: [ { id, text, difficultyEstimated }, ... ], params: {...} }
# e aponte R_INPUT_JSON para ele antes de executar.

source(file.path(getwd(), "r-scripts", "stage2_difficulty.R"))
`;
}

export function generateIrtScript(opts: { construct: string; params: IrtParams }): string {
  const p = opts.params;
  return `${HEADER}
# --- Parâmetros vindos do formulário ----------------------------------------
construct <- ${rString(opts.construct)}
params <- list(
  irtModel       = ${rString(p.irtModel)},
  responseFormat = ${rString(p.responseFormat)},
  models         = ${rCharVec(p.models)},
  syntheticN     = ${rNum(p.syntheticN)},
  temperature    = ${rNum(p.temperature)},
  personaSeed    = ${rString(p.personaSeed || "")}
)

# Os itens calibráveis são carregados em runtime pelo backend.
# Ao reproduzir manualmente, monte um JSON com:
#   { construct, items: [ { id, text }, ... ], params: {...} }

source(file.path(getwd(), "r-scripts", "stage3_irt.R"))
`;
}

export function generateSampleDesignScript(opts: { params: SampleDesignParams }): string {
  const p = opts.params;
  const strataR = p.strata
    .map(
      (s) =>
        `  list(label = ${rString(s.label)}, populationShare = ${rNum(
          s.populationShare,
        )}, sampledN = ${s.sampledN == null ? "NULL" : rNum(s.sampledN)})`,
    )
    .join(",\n");
  return `${HEADER}
# --- Parâmetros vindos do formulário ----------------------------------------
targetSampleN     <- ${rNum(p.targetSampleN)}
targetThetaSE     <- ${rNum(p.targetThetaSE ?? 0.32)}
shortlistMaxItems <- ${p.shortlistMaxItems == null ? "NULL" : rNum(p.shortlistMaxItems)}

strata <- list(
${strataR}
)

# Os itens calibrados (com discriminação/dificuldade/guessing) são carregados
# em runtime pelo backend a partir do projeto e injetados como
#   inp$calibratedItems

source(file.path(getwd(), "r-scripts", "stage5_sample_design.R"))
`;
}

export function generateScriptForStage(
  stage: Stage,
  args: {
    construct?: string;
    params: AigenieParams | DifficultyParams | IrtParams | SampleDesignParams;
  },
): string {
  switch (stage) {
    case "aigenie":
      return generateAigenieScript({
        construct: args.construct ?? "",
        params: args.params as AigenieParams,
      });
    case "difficulty":
      return generateDifficultyScript({ params: args.params as DifficultyParams });
    case "irt":
      return generateIrtScript({
        construct: args.construct ?? "",
        params: args.params as IrtParams,
      });
    case "sample_design":
      return generateSampleDesignScript({ params: args.params as SampleDesignParams });
  }
}
