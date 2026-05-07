/**
 * R script preview generator — backend is the source of truth for the
 * R syntax shown in the UI's read-only editor, downloaded as `.R`, AND
 * executed by the R engine. The runtime path POSTs the exact script text
 * to Plumber's /run/script endpoint, so what the user previews is what
 * actually runs.
 *
 * Each generated script:
 *   1. Sources `_common.R` (logging + JSON I/O contract).
 *   2. Declares the form-derived params as a top-level R `list(...)` —
 *      these are the source of truth; editing them changes behavior.
 *   3. Reads the runtime payload from `R_INPUT_JSON` (items, project
 *      metadata, calibrated items, ...), overlays the local params on top,
 *      writes the merged JSON, then sources the canonical stage script in
 *      `r-scripts/`.
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
# Gerado automaticamente pelo PsychGen BR — fonte da verdade.
# Este script é tanto o que você vê no painel "Sintaxe R" quanto o que de fato
# executa no servidor R. Para reproduzir manualmente:
#   export R_INPUT_JSON=runtime_payload.json
#   export R_OUTPUT_JSON=output.json
#   Rscript este_arquivo.R
# ============================================================================
source(file.path(getwd(), "r-scripts", "_common.R"))
`;

const MERGE_AND_SOURCE = (stageScript: string, overrides: string) => `
# --- Merge form params into the runtime payload supplied by the API ---------
inp <- if (Sys.getenv("R_INPUT_JSON") != "" && file.exists(Sys.getenv("R_INPUT_JSON")))
         jsonlite::fromJSON(Sys.getenv("R_INPUT_JSON"), simplifyVector = FALSE)
       else
         list()
${overrides}
.merged_path <- tempfile(fileext = ".json")
writeLines(jsonlite::toJSON(inp, auto_unbox = TRUE, null = "null"), .merged_path)
Sys.setenv(R_INPUT_JSON = .merged_path)

source(file.path(getwd(), "r-scripts", "${stageScript}"))
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
${MERGE_AND_SOURCE("stage1_aigenie.R", "inp$construct <- construct\ninp$params <- params")}`;
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
${MERGE_AND_SOURCE("stage2_difficulty.R", "inp$params <- params")}`;
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
${MERGE_AND_SOURCE("stage3_irt.R", "inp$construct <- construct\ninp$params <- params")}`;
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
${MERGE_AND_SOURCE(
  "stage5_sample_design.R",
  `inp$targetSampleN     <- targetSampleN
inp$targetThetaSE     <- targetThetaSE
inp$shortlistMaxItems <- shortlistMaxItems
inp$strata            <- strata`,
)}`;
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
