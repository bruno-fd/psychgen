import { db, projectsTable, itemsTable, reportsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectsTable);
  if (count > 0) {
    console.log(`Seed skipped: ${count} projects already exist.`);
    process.exit(0);
  }

  const [bdi] = await db
    .insert(projectsTable)
    .values({
      name: "BDI-BR Adaptação 2026",
      construct: "Sintomas depressivos",
      description:
        "Adaptação brasileira contemporânea do Inventário de Depressão de Beck para população adulta urbana, com calibração via respondentes sintéticos LLM.",
      language: "pt-BR",
      targetAudience: "Adultos 18-65 anos, ensino médio completo",
      publisher: "Hogrefe CETEPP",
      status: "draft",
    })
    .returning();

  const [big5] = await db
    .insert(projectsTable)
    .values({
      name: "Big Five Brasileiro Reduzido",
      construct: "Personalidade — Extroversão",
      description:
        "Banco de itens curtos para a faceta Extroversão do modelo de cinco fatores, calibrado por TRI 2PL.",
      language: "pt-BR",
      targetAudience: "Adultos brasileiros, todas as escolaridades",
      publisher: "Vetor Editora",
      status: "ready",
    })
    .returning();

  const [enem] = await db
    .insert(projectsTable)
    .values({
      name: "Banco Pré-ENEM Matemática",
      construct: "Raciocínio quantitativo",
      description:
        "Itens dicotômicos de matemática nível médio, com predição de dificuldade ML antes de pré-teste.",
      language: "pt-BR",
      targetAudience: "Estudantes do ensino médio (15-19 anos)",
      publisher: "Casa do Psicólogo",
      status: "calibrating",
    })
    .returning();

  if (big5) {
    const exampleItems = [
      "Sou o tipo de pessoa que se sente energizado em festas com muita gente.",
      "Costumo iniciar conversas com desconhecidos sem dificuldade.",
      "Prefiro ficar em casa lendo do que sair com amigos.",
      "Sinto-me confortável sendo o centro das atenções.",
      "Em grupos sociais, tendo a falar bastante.",
      "Pessoas próximas me descrevem como reservado.",
      "Gosto de planejar atividades que reúnam muitas pessoas.",
      "Após um longo dia social, preciso de tempo sozinho para me recuperar.",
    ];
    await db.insert(itemsTable).values(
      exampleItems.map((text, i) => ({
        projectId: big5.id,
        text,
        construct: big5.construct,
        dimension: "Extroversão",
        status: i < 6 ? "approved" : "needs_review",
        generatedBy: "gpt-4o",
        difficultyEstimated: -1.5 + i * 0.4,
        difficultyPredicted: -1.4 + i * 0.42,
        discrimination: 1.2 + (i % 3) * 0.3,
        egaCommunity: 0,
      })),
    );
    await db.insert(reportsTable).values({
      projectId: big5.id,
      kind: "irt",
      summary: "Calibração 2PL via 500 respondentes sintéticos (gpt-3.5-turbo + claude-haiku-4-5). Confiabilidade 0.842.",
      metricsJson: {
        irtModel: "2PL",
        syntheticN: 500,
        responsesGenerated: 487,
        reliability: 0.842,
        modelFit: { CFI: 0.96, TLI: 0.94, RMSEA: 0.052 },
      },
    });
  }

  if (enem) {
    const mathItems = [
      "Se 3x + 7 = 22, qual é o valor de x?",
      "Calcule a área de um triângulo com base 6 cm e altura 4 cm.",
      "Quanto é 15% de 240?",
      "A função f(x) = 2x² - 3x + 1 tem quantas raízes reais?",
      "Em uma progressão aritmética com a₁=3 e razão 5, qual o décimo termo?",
    ];
    await db.insert(itemsTable).values(
      mathItems.map((text, i) => ({
        projectId: enem.id,
        text,
        construct: enem.construct,
        dimension: "Álgebra básica",
        status: "needs_review",
        generatedBy: "gpt-4o",
        difficultyPredicted: -1 + i * 0.5,
      })),
    );
  }

  if (bdi) {
    await db.insert(reportsTable).values({
      projectId: bdi.id,
      kind: "aigenie",
      summary: "Geração inicial de pool conceitual aguardando execução.",
      metricsJson: { stage: "pre-generation" },
    });
  }

  console.log("Seed completo.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
