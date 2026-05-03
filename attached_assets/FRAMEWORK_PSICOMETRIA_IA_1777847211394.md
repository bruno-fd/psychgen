# Framework de Psicometria com IA — Documentação Completa da Sessão

> **Gerado em:** 03/05/2026  
> **Continuação:** Claude Code  
> **Objetivo:** Documentar integralmente a sessão de planejamento estratégico e técnico para construção de um sistema automatizado de desenvolvimento e validação de instrumentos psicométricos para o mercado editorial brasileiro.

---

## 1. CONTEXTO DE NEGÓCIO

### 1.1 O Problema que Estamos Resolvendo

O mercado editorial de testes psicológicos no Brasil enfrenta três problemas centrais:

1. **Velocidade de criação de novas medidas** — o processo tradicional de desenvolvimento de um teste psicológico leva anos e envolve equipes de pesquisadores, coletas massivas de dados e múltiplas rodadas de revisão. O custo pode ser de dezenas de milhares de reais por instrumento.

2. **Vazamento de testes** — quando um teste psicológico vaza (itens tornam-se de conhecimento público), ele deixa de poder ser usado clinicamente. Isso representa perda de receita imediata para as editoras e deixa lacunas na avaliação psicológica brasileira sem substituto disponível.

3. **Ausência de testagem adaptativa computadorizada (CAT)** — nenhuma editora brasileira opera um banco de itens robusto o suficiente para implementar CAT, que é o estado da arte em avaliação psicológica mundial.

### 1.2 O Mercado

O mercado brasileiro de testes psicológicos é altamente concentrado, com 4 a 5 editoras principais:

- **Hogrefe** (Brasil)
- **Vetor / Giunti**
- **NilaPres**
- **Pearson Clinical**
- (Casa do Psicólogo / distribuição)

Essa concentração é um fator de risco e de oportunidade: cada relacionamento comercial vale muito, e não há necessidade de escalar para dezenas de clientes para ter um negócio sólido.

### 1.3 O Modelo de Negócio

**O que NÃO fazer:**
- Vender o framework (licença única) — você recebe uma vez e perde o controle
- Consultoria por projeto sem recorrência

**O que fazer:**
- Ser um **prestador de serviço de P&D psicométrico**, não uma software house
- Cobrar **por produto entregue**: por teste novo, por versão alternativa, por banco de itens, por revalidação
- Não se vincular exclusivamente a nenhuma editora — operar como fornecedor não-exclusivo para todas
- O software roda internamente para o prestador de serviço (sem distribuição — sem implicações de licença AGPL)

**Produtos comercializáveis:**
- Versões alternativas (formas paralelas) de testes existentes — resolve o problema do vazamento
- Revalidações de medidas antigas
- Bancos de itens para CAT
- Testes novos em construtos emergentes ou sub-representados no SATEPSI

### 1.4 Estratégia de Entrada no Mercado

1. Escolher uma editora menor para o primeiro piloto (menos burocracia)
2. Pegar um teste com problema conhecido (itens vazados ou versão desatualizada) do catálogo dela
3. Entregar uma versão alternativa validada como piloto — isso é mais persuasivo que qualquer apresentação
4. Documentar tudo: tempo, qualidade psicométrica, comparação com processo tradicional
5. Negociar modelo de parceria a partir de dados reais

**Argumento central para as editoras:**
- Redução de custo de P&D
- Proteção do catálogo contra vazamentos com formas alternativas infinitas
- Abertura de receita nova via CAT
- Tudo sem precisar montar uma equipe técnica interna

**Ponto crítico regulatório:** As editoras vão perguntar sobre o SATEPSI (Sistema de Avaliação de Testes Psicológicos do CFP) e a Resolução CFP 31/2022. O framework precisa se encaixar nas exigências de evidências de validade. O pipeline que estamos construindo **prevê coleta de evidências estruturadas**, o que é diferencial — não é só geração de itens, é geração **validada**.

---

## 2. ARQUIVOS LIDOS NESTA SESSÃO

### 2.1 Código-fonte do AIGENIE

**Arquivo recebido:** `AIGENIE-main.zip`  
**Conteúdo descompactado em:** `/home/claude/aigenie/AIGENIE-main/`

**Estrutura principal:**
```
AIGENIE-main/
├── DESCRIPTION              # Metadados do pacote R (versão 2.1.0, data 2026-03-10)
├── README.md                # Documentação de instalação
├── R/
│   ├── main_v2.R            # Função principal AIGENIE()
│   ├── item_generation.R    # Geração de itens via LLM
│   ├── embeddings.R         # Embeddings via LLM encoder
│   ├── llm_providers.R      # Integração com OpenAI, Anthropic, Groq, HuggingFace
│   ├── pipeline_helpers_optimized.R     # EGA, UVA, bootEGA
│   ├── pipeline_parent_functions_optimized.R
│   ├── user_validation.R    # Validação de inputs (função GENIE)
│   ├── user_validation_helpers.R
│   ├── user_validation_helpers_GENIE.R
│   ├── local_user_validation_helpers.R  # Suporte a modelos locais
│   └── generation_utils.R
├── man/                     # Documentação de todas as funções (.Rd)
└── tests/
    └── testthat/test-validation.R
```

**Licença:** AGPL-3 (relevante: sem implicações para uso interno; apenas para distribuição de software)

### 2.2 Preprint do AIGENIE

**Arquivo recebido:** `aigenie-preprint.pdf`  
**Título:** *The Ultimate Tutorial for AI-driven Scale Development in Generative Psychometrics: Releasing AIGENIE from its Bottle*  
**Autores:** Lara Russell-Lasalandra, Hudson Golino, Luis Garrido, Alexander Christensen  
**Instituições:** University of Virginia, Vanderbilt University, Pontificia Universidad Madre y Maestra (República Dominicana)

### 2.3 Artigo Bhandari et al. (2024)

**Arquivo recebido:** `1-s2_0-S2666920X24000870-main.pdf`  
**Título:** *Evaluating the psychometric properties of ChatGPT-generated questions*  
**Autores:** Shreya Bhandari, Yunting Liu, Yerin Kwak, Zachary A. Pardos (UC Berkeley)  
**Publicação:** Computers and Education: Artificial Intelligence, 7 (2024) 100284

### 2.4 Artigo Štěpánek, Dlouhá & Martinková (2023)

**Arquivo recebido:** `mathematics-11-04104.pdf`  
**Título:** *Item Difficulty Prediction Using Item Text Features: Comparison of Predictive Performance across Machine-Learning Algorithms*  
**Autores:** Lubomír Štěpánek, Jana Dlouhá, Patrícia Martinková (Czech Academy of Sciences / Charles University)  
**Publicação:** Mathematics 2023, 11, 4104

### 2.5 Artigo Rujas et al. (2025)

**Arquivo recebido:** `1-s2_0-S138650562400426X-main.pdf`  
**Título:** *Synthetic data generation in healthcare: A scoping review of reviews on domains, motivations, and future applications*  
**Publicação:** International Journal of Medical Informatics 195 (2025) 105763  
**Relevância para o projeto:** Baixa — foco em dados sintéticos na área de saúde (imagens médicas, dados clínicos). Princípios gerais úteis, mas aplicação em domínio diferente.

### 2.6 Patente Licato et al. (2024)

**Arquivo recebido:** `US20240339042A1.pdf`  
**Título:** *Automatically Creating Psychometrically Valid and Reliable Items Using Generative Language Models*  
**Inventores:** John Licato, Antonio Vincent Laverghetta JR. (University of South Florida)  
**Número:** US 2024/0339042 A1  
**Data de publicação:** 10 de outubro de 2024  
**Status:** Pedido de patente publicado (ainda NÃO concedida — processo leva 2-3 anos no USPTO)

### 2.7 Artigo Nature (acessado via URL)

**URL:** https://www.nature.com/articles/d41586-023-01445-8  
**Título:** *Synthetic data could be better than real data*  
**Publicação:** Nature Outlook, 27 de abril de 2023  
**Relevância:** Contexto geral sobre dados sintéticos; não específico para psicometria.

### 2.8 Literatura encontrada via busca (não recebida como arquivo)

**Liu et al. (2025)** — *Leveraging LLM Respondents for Item Evaluation: A Psychometric Analysis*  
British Journal of Educational Technology  
URL: https://bera-journals.onlinelibrary.wiley.com/doi/10.1111/bjet.13570  
**Extremamente relevante** — ver seção 4.5

**Arxiv 2507.05890 (2026)** — *Psychometric Item Validation Using Virtual Respondents with Trait-Response Mediators*  
URL: https://arxiv.org/pdf/2507.05890  
**Muito relevante** — ver seção 4.6

---

## 3. O AIGENIE — ENTENDIMENTO TÉCNICO COMPLETO

### 3.1 O que é

AIGENIE é um pacote R (versão 2.1.0) que implementa o framework **AI-GENIE** (Automatic Item Generation with Network-Integrated Evaluation). Integra geração de texto via LLMs com psicometria em rede (network psychometrics) para automatizar as etapas iniciais do desenvolvimento de escalas psicológicas.

**Disponível em:** https://laralee.r-universe.dev/AIGENIE  
**Gratuito para uso não-comercial**

### 3.2 As duas funções principais

#### AIGENIE()
Pipeline completo: gera itens + valida estruturalmente.

#### GENIE()
Apenas a pipeline de validação — sem geração. Aceita itens já existentes (humanos ou gerados externamente) e os valida/reduz psicometricamente. **Esta é a função mais importante para o caso de uso de formas alternativas de testes existentes.**

### 3.3 Pipeline de 6 Etapas

```
Etapa 0: Gerar ou escrever o pool inicial de itens
         - Via LLM (AIGENIE) ou manualmente (GENIE)
         
Etapa 1: Embeddings
         - Cada item → vetor numérico de alta dimensão via LLM encoder
         - Captura semântica e contexto
         
Etapa 2: Avaliar o pool inicial
         - Roda EGA (Exploratory Graph Analysis) no pool
         - Estima estrutura dimensional
         - Calcula NMI (Normalized Mutual Information) como baseline
         - NMI = 0% → estrutura completamente diferente do esperado
         - NMI = 100% → detecção perfeita das comunidades de itens
         
Etapa 3: Remover itens redundantes
         - UVA (Unique Variable Analysis) detecta sobreposição semântica excessiva
         - Remove iterativamente o item mais redundante de cada par/cluster
         - Repete até não haver mais redundâncias
         
Etapa 4: Seleção sparse vs. full embeddings
         - Roda EGA na matriz de embeddings completa E na versão esparsificada
         - Mantém o tipo que produz maior NMI para as etapas seguintes
         
Etapa 5: Remover itens instáveis
         - bootEGA: 100 reamostras da matriz de embeddings
         - Itens que mudam de comunidade frequentemente → instáveis → removidos
         - Repete até todos os itens restantes serem estáveis
         
Etapa 6: Pool final pronto
         - EGA final no pool reduzido
         - NMI final comparado ao baseline
         - Pool entregue ao pesquisador para revisão humana e teste empírico
```

### 3.4 Provedores de LLM Suportados

| Provedor | Uso | Observações |
|---|---|---|
| OpenAI | Geração + Embeddings | Embeddings: text-embedding-3-small (padrão). Requer cartão de crédito. |
| Anthropic | Geração | Requer pré-pago ($5 mínimo). Claude família de modelos. |
| Groq | Geração | Modelos open-source (Llama, Mixtral). Uso moderado gratuito. |
| HuggingFace | Geração + Embeddings | Milhares de modelos. API token necessário. |
| Jina AI | Embeddings | 10M tokens gratuitos. |
| Local (llama-cpp) | Geração + Embeddings | Para uso offline/privacidade. Menor qualidade. |

### 3.5 Parâmetros Mais Importantes da Função AIGENIE()

```r
AIGENIE(
  item.attributes,        # Lista nomeada: dimensões → atributos/facetas
  model,                  # Modelo de geração (ex: "gpt-5.1", "claude-opus-4")
  embedding.model,        # Modelo de embedding (ex: "text-embedding-3-small")
  openai.API,             # Chave da API
  anthropic.API,          # Chave da API
  domain,                 # Domínio da pesquisa (ex: "personality measurement")
  scale.title,            # Nome da escala
  audience,               # Público-alvo (ex: "adultos brasileiros")
  item.type.definitions,  # Lista: definição de cada dimensão
  response.options,       # Opções de resposta (ex: "discordo" a "concordo")
  item.examples,          # DataFrame com exemplos de itens de qualidade
  prompt.notes,           # Instruções customizadas adicionais
  system.role,            # Persona do modelo (ex: "você é um psicometrista expert")
  target.N,               # Número alvo de itens por dimensão (ex: 60)
  temperature,            # Temperatura do LLM (padrão: 1.0)
  top.p,                  # Nucleus sampling (padrão: 1.0)
  adaptive,               # TRUE: previne repetição de itens entre chamadas
  items.only,             # TRUE: só gera itens, sem rodar a pipeline
  embeddings.only,        # TRUE: gera itens + embeddings, sem pipeline
  run.overall,            # TRUE: adiciona análise EGA do pool combinado
  all.together,           # TRUE: roda pipeline em todos os itens juntos
  keep.org                # TRUE: mantém itens originais pré-redução
)
```

### 3.6 Uso do item.examples para Formas Alternativas

**Este é o mecanismo central para o caso de uso de testes vazados:**

```r
# Itens originais do teste vazado como âncora de estilo
exemplos <- data.frame(
  statement = c("Item original 1...", "Item original 2...", ...),
  type = c("dimensao_1", "dimensao_1", ...),
  attribute = c("atributo_1", "atributo_2", ...)
)

resultado <- AIGENIE(
  item.attributes = atributos_do_teste,
  item.examples = exemplos,    # ← âncora de estilo/registro
  prompt.notes = "Gere itens que meçam os mesmos construtos com 
                  linguagem equivalente, mas com conteúdo inteiramente novo.",
  adaptive = TRUE,             # ← previne cópias/paráfrases
  ...
)
```

Com `adaptive = TRUE` e `item.examples` preenchido, o LLM é instruído a:
- Manter o mesmo estilo e nível de linguagem dos exemplos
- Manter o mesmo formato de resposta
- Gerar conteúdo genuinamente novo — não paráfrases
- Cobrir os mesmos construtos/dimensões

O resultado são **formas alternativas paralelas** psicometricamente equivalentes.

### 3.7 Estrutura do Output

```
resultado$item_type_level$[dimensao]/
  ├── final_items       # DataFrame: itens que sobreviveram à pipeline
  ├── start_N           # N de itens antes da redução
  ├── final_N           # N de itens após redução
  ├── initial_NMI       # NMI antes da redução (baseline)
  ├── final_NMI         # NMI após redução
  ├── UVA               # Resultados da análise de redundância
  ├── bootEGA           # Resultados da análise de estabilidade
  ├── EGA.model_selected # TMFG ou EBICglasso
  ├── initial_EGA       # Rede antes da redução
  ├── final_EGA         # Rede após redução
  ├── embeddings        # Matrizes full e sparse
  ├── network_plot      # Visualização das redes (ggplot/patchwork)
  └── stability_plot    # Visualização da estabilidade (ggplot/patchwork)

resultado$overall/
  └── final_items       # Todos os itens finais de todas as dimensões
```

---

## 4. LITERATURA TÉCNICA — CONTRIBUIÇÕES PARA O FRAMEWORK

### 4.1 Bhandari et al. (2024) — Equivalência IRT entre Itens Humanos e de IA

**O que fizeram:** Compararam 15 itens de álgebra gerados pelo ChatGPT com 15 itens humanos (OpenStax) usando linking IRT com 316 respondentes reais (recrutados via Prolific).

**Design:** 6 formas de teste com linking por itens comuns (common item equating). ~50 respondentes por forma. Calibração concorrente via Rasch e 2PL.

**Resultados principais:**
- Parâmetros de dificuldade: **sem diferença significativa** entre IA e humanos (t = -0.80, p = 0.44)
- Discriminação média: IA = 1.69 vs humanos = 1.26 — IA **marginalmente melhor** (t = -1.40, p = 0.17)
- Tempo de resposta: **sem diferença significativa** (p = 0.88)
- Unidimensionalidade: ambos os pools não violaram (p = 0.52 e p = 0.08)
- Confiabilidade combinada: alpha = 0.88 (aceitável)
- Similaridade semântica (cosine embedding): itens de IA com OpenStax 2.2 = 0.4439; com lições adjacentes = 0.39 e 0.16 → itens gerados cobrem o construto-alvo e não escapam para construtos vizinhos

**O que isso adiciona ao framework:**

Evidência empírica de que itens de IA têm propriedades IRT equivalentes a itens humanos quando aplicados a respondentes reais. Fornece:

1. **Argumento comercial** para as editoras ("itens de IA não são inferiores")
2. **Metodologia replicável** para o módulo de validação empírica mínima
3. **Design amostral eficiente**: ~150 respondentes válidos por item (mínimo Rasch) com 6 formas e ~50 por forma

**Notas técnicas:**
- Análise IRT via modelo Rasch (1PL) e 2PL
- Calibração concorrente (todos os formulários juntos) — mais eficiente que calibração separada
- Verificação de unidimensionalidade via correlação tetracórica + Monte Carlo
- Análise de similaridade semântica via Sentence-BERT + PCA 2D + cosine similarity

### 4.2 Štěpánek, Dlouhá & Martinková (2023) — Predição de Dificuldade por ML

**O que fizeram:** Extraíram 69 features textuais de itens de compreensão de leitura em inglês (exame de maturidade tcheco, 2016-2023, n=40 itens, 50.000+ respondentes/ano) e compararam 7 algoritmos de ML na predição de dificuldade IRT.

**Resultado principal:** Elastic net (RMSE = 0.666) **superou especialistas humanos** (RMSE = 1.004) na predição contínua de dificuldade. Random forest empatou com experts na classificação por categorias (acurácia estendida = 0.650 em ambos).

**Features textuais mais importantes (por MSEincrease):**
1. Número total de caracteres (5.912)
2. Desvio padrão do comprimento das palavras em caracteres (4.845)
3. Similaridade word2vec entre passagem e distratores (3.521)
4. Índice de legibilidade Traenkle-Bailer (3.385)
5. Similaridade word2vec entre questão e gabarito (2.447)
6. Índice FOG (1.355)
7. Índice Dale-Chall (1.266 via elastic net)

**Modelo elastic net final identificou:**
- Mais caracteres → maior dificuldade (β = 0.002)
- Maior variação no comprimento das palavras → maior dificuldade (β = 0.809)
- Índices FOG e Dale-Chall positivos → maior dificuldade
- Maior similaridade word2vec entre gabarito e distratores → maior dificuldade (β = 0.023)

**O que isso adiciona ao framework:**

Um **módulo de predição de dificuldade *in silico*** totalmente automatizável. Antes de qualquer coleta de dados humanos, extraímos as features textuais de cada item gerado e predizemos sua dificuldade IRT.

**Adaptações necessárias para o contexto brasileiro:**
- Corpus de referência: substituir COCA (inglês americano) por corpus brasileiro — candidatos: **AC/DC**, **Corpus do Português** (Mark Davies), ou **brWaC**
- Índices de legibilidade: substituir Dale-Chall e FOG por versões adaptadas para português — **Índice de Flesh adaptado para PT-BR** e **Coh-Metrix-Port**
- Treinar o modelo de predição com dados de itens brasileiros (se disponíveis das editoras)

**Pacotes R usados pelos autores:**
- `eRm` — modelo Rasch
- `quanteda` — pré-processamento textual
- `glmnet` — elastic net / LASSO / ridge
- `e1071` — Naïve Bayes e SVM
- `rpart` — árvores de decisão
- `randomForest` — random forests
- `neuralnet` — redes neurais

### 4.3 Patente Licato et al. (US 2024/0339042 A1) — Sistema Iterativo com Propriedades Psicométricas

**O que descrevem:** Sistema que usa propriedades psicométricas dos itens existentes como critério de otimização na geração de novos itens, em loop iterativo.

**Pipeline da patente:**
```
1. Recebe banco de itens humanos (item bank)
2. Pontua propriedades psicométricas de cada item (dificuldade, discriminação, confiabilidade)
3. Ordena itens por propriedade psicométrica de interesse
4. Gera prompt usando top-k (melhores) E bottom-k (piores) itens como exemplos
5. LLM gera novos itens baseados no prompt
6. Pontua propriedades psicométricas dos itens gerados
7. Filtra itens abaixo de threshold
8. Adiciona itens aprovados ao banco
9. Repete iterativamente
```

**Diferença crítica em relação ao AIGENIE:**
- A patente usa **ranking de propriedades IRT** para guiar a geração
- O AIGENIE usa **embeddings + EGA** para validar estruturalmente
- São abordagens complementares, não idênticas

**Implicação jurídica para o projeto:**
- A patente ainda **não foi concedida** (pedido publicado em outubro/2024)
- Processo de concessão leva 2-3 anos no USPTO
- Protege a **implementação tecnológica**, não o **serviço de consultoria**
- O usuário não está distribuindo software — está prestando serviço. São juridicamente distintos.
- O pipeline que estamos construindo integra abordagens diferentes (EGA + ML + LLM respondents) que não são cobertas pela reivindicação da patente

### 4.4 Rujas et al. (2025) — Dados Sintéticos em Saúde (referência marginal)

Revisão de escopo sobre geração de dados sintéticos em 13 domínios de saúde (oncologia, neurologia, cardiologia, etc.). Foco em imagens médicas, séries temporais clínicas e dados tabulares de saúde.

**Por que incluímos:** Mapeia as motivações para geração de dados sintéticos (privacidade, escassez de dados, qualidade, desenvolvimento de IA) e os casos de uso (treinamento de modelos, compartilhamento de dados, educação). Esses princípios são análogos ao domínio psicométrico.

**Não recomendamos aprofundar** essa literatura para o projeto — domínio muito diferente.

### 4.5 Liu et al. (2025) — LLMs como Respondentes Sintéticos para Calibração IRT

**Título:** *Leveraging LLM Respondents for Item Evaluation: A Psychometric Analysis*  
**Publicação:** British Journal of Educational Technology  
**URL:** https://bera-journals.onlinelibrary.wiley.com/doi/10.1111/bjet.13570

**O que fizeram:** Usaram 6 LLMs diferentes (GPT-3.5, GPT-4, Llama 2, Llama 3, Gemini-Pro, Cohere Command R Plus) como substitutos de respondentes humanos para calibrar itens de álgebra via IRT.

**Resultados principais:**
- Alguns LLMs têm proficiência similar ou superior à de estudantes universitários
- LLMs individuais têm **distribuições de proficiência estreitas** — não replicam bem a variabilidade humana
- **Ensemble de LLMs** (múltiplos modelos respondendo) aproxima melhor a distribuição humana
- Correlação IRT (LLM vs humanos): > 0.8 para GPT-3.5
- Melhor estratégia de augmentation: **resampling** → correlação de Spearman de 0.89 para **0.93**

**O que isso adiciona ao framework:**

Este é o **componente mais revolucionário** do nosso pipeline. Permite calibração IRT preliminar **sem coletar nenhum dado humano**.

Ao invés de recrutar centenas de participantes para calibrar os itens gerados, você:
1. Pega os itens gerados e validados pelo AIGENIE
2. Apresenta cada item para um ensemble de LLMs como se fossem respondentes
3. Cada LLM "responde" com uma probabilidade de acerto ou escolha de alternativa
4. Agrega as respostas simuladas
5. Roda calibração IRT nessas respostas sintéticas
6. Obtém estimativas preliminares de dificuldade e discriminação

### 4.6 Arxiv 2507.05890 (2026) — Validação de Itens via Respondentes Virtuais com Mediadores

**Título:** *Psychometric Item Validation Using Virtual Respondents with Trait-Response Mediators*  
**URL:** https://arxiv.org/pdf/2507.05890

**O que propõem:** Validação de validade de construto de itens usando respondentes virtuais (LLMs) com mediadores de traço-resposta — ou seja, o LLM é instruído a responder "como uma pessoa com alto/baixo nível de determinado traço psicológico".

**Por que é importante:** Enquanto Liu et al. focam em validade convergente dos parâmetros IRT, este trabalho ataca a **validade de construto** — se os itens gerados realmente medem o que pretendem medir, antes de qualquer coleta de dados humanos.

---

## 5. O FRAMEWORK QUE ESTAMOS CONSTRUINDO

### 5.1 Nome de Trabalho

**PsychGen BR** — Sistema de Geração e Validação Psicométrica Automatizada para o Mercado Brasileiro

### 5.2 Arquitetura Geral

O sistema é uma **interface web (app)** que opera internamente para o prestador de serviço. O usuário (psicometrista/operador) configura projetos, seleciona parâmetros e aciona os módulos. Os resultados são gerados automaticamente e exportados em relatórios.

**Tecnologia de interface:** A ser definida — candidatos: Shiny (R nativo), ou interface web separada que chama scripts R via API.

**Não há código que o usuário precise digitar.** Toda a operação é via interface gráfica.

### 5.3 Pipeline Completo — 5 Estágios

```
┌─────────────────────────────────────────────────────────────┐
│  ESTÁGIO 1: GERAÇÃO E VALIDAÇÃO ESTRUTURAL IN SILICO        │
│  Motor: AIGENIE (R package)                                  │
│                                                              │
│  Input: Atributos do construto, exemplos, instruções         │
│  Output: Pool de itens estruturalmente validados             │
│                                                              │
│  - Geração via LLM (OpenAI / Anthropic / Groq)              │
│  - Embeddings (OpenAI / Jina AI)                             │
│  - EGA → estrutura dimensional                               │
│  - UVA → remoção de redundâncias semânticas                  │
│  - bootEGA → estabilidade dos itens                          │
│  - NMI baseline vs. final                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  ESTÁGIO 2: PREDIÇÃO DE DIFICULDADE IN SILICO               │
│  Motor: ML sobre features textuais (Štěpánek et al.)         │
│                                                              │
│  Input: Texto dos itens do pool validado                     │
│  Output: Estimativa de dificuldade + categoria               │
│                                                              │
│  - Extração de 60+ features textuais por item                │
│  - Contagens, legibilidade, similaridade semântica           │
│  - Adaptado para português: corpus brWaC/AC-DC               │
│  - Índices de legibilidade calibrados para PT-BR             │
│  - Modelo: elastic net (predição contínua) +                 │
│            random forest (classificação por categoria)       │
│  - Output: dificuldade estimada + categoria                  │
│    (muito fácil / fácil / moderado / difícil / muito difícil)│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  ESTÁGIO 3: CALIBRAÇÃO IRT VIA RESPONDENTES SINTÉTICOS      │
│  Motor: Ensemble de LLMs (Liu et al., 2025)                  │
│                                                              │
│  Input: Itens do pool + instruções de persona                │
│  Output: Estimativas preliminares de parâmetros IRT          │
│                                                              │
│  - LLMs instruídos como respondentes com diferentes perfis   │
│  - Ensemble: múltiplos modelos → distribuição de habilidade  │
│  - Estratégia resampling para augmentation                   │
│  - Calibração IRT: modelo Rasch ou 2PL via mirt (R)         │
│  - Wright Map preliminar                                     │
│  - Identificação de itens com dificuldade/discriminação      │
│    inadequadas antes da coleta empírica                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  ESTÁGIO 4: REVISÃO HUMANA E CURADORIA                       │
│  Motor: Interface de revisão no app                          │
│                                                              │
│  Input: Pool com todas as estimativas dos estágios 1-3       │
│  Output: Pool aprovado e curado                              │
│                                                              │
│  - Interface de revisão item a item                          │
│  - Checklist de qualidade (linguagem, adequação, danos)      │
│  - Edição direta de itens                                    │
│  - Aprovação/rejeição com comentários                        │
│  - Seleção de formas finais (seleção de itens para CAT)      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  ESTÁGIO 5: VALIDAÇÃO EMPÍRICA MÍNIMA + LINKING              │
│  Motor: Coleta + mirt + equateIRT (R)                        │
│                                                              │
│  Input: Pool curado + design amostral                        │
│  Output: Parâmetros IRT confirmados + evidências de validade │
│                                                              │
│  - Design de formas com itens âncora (common item equating)  │
│  - ~150 respondentes válidos por item (mínimo Rasch)         │
│  - Recrutamento: Prolific (BR) ou universidades parceiras    │
│  - Calibração concorrente via mirt                           │
│  - Wright Map final                                          │
│  - Linking com teste original (para formas alternativas)     │
│  - Análise de similaridade semântica (embeddings + cosine)   │
│  - Geração do relatório de evidências de validade            │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Casos de Uso Cobertos pelo Pipeline

#### Caso A: Forma Alternativa de Teste Vazado
```
- Input: Itens originais do teste vazado como item.examples
- AIGENIE gera pool alternativo no mesmo estilo/construto
- Pipeline completa → forma alternativa com evidências de equivalência
- Produto entregue: forma B (ou C, D...) com relatório de validade
```

#### Caso B: Banco de Itens para CAT
```
- Input: Construto alvo + especificação de atributos
- AIGENIE gera pool grande (ex: target.N = 80 por dimensão)
- Pipeline completa com foco em cobertura da curva de dificuldade
- Estágio 2 garante distribuição de dificuldade balanceada
- Produto entregue: banco de itens calibrado, pronto para CAT
```

#### Caso C: Instrumento Novo
```
- Input: Construto emergente + revisão de literatura
- AIGENIE gera pool completo
- Pipeline completa
- Produto entregue: instrumento com evidências iniciais de validade
```

#### Caso D: Revalidação de Medida Existente
```
- Input: Itens existentes do instrumento a ser revalidado
- GENIE() aplica pipeline de validação sem geração
- Identifica itens problemáticos (redundantes, instáveis)
- Sugere versão reduzida psicometricamente superior
- Produto entregue: versão revisada com evidências de melhoria
```

### 5.5 Outputs do Sistema para as Editoras

Para cada produto entregue, o sistema gera automaticamente:

1. **Pool de itens final** — planilha com: texto do item, dimensão, atributo, comunidade EGA, dificuldade estimada, categoria de dificuldade, estabilidade bootEGA, parâmetros IRT (se estágio 5 realizado)

2. **Relatório de evidências estruturais** — redes EGA antes/depois, NMI baseline vs. final, resultados UVA, plots de estabilidade

3. **Relatório de propriedades textuais** — features de legibilidade, distribuição de dificuldade predita por ML, Wright Map preliminar (sintético)

4. **Relatório de validação empírica** (quando Estágio 5 realizado) — parâmetros IRT, Wright Map final, análise de linking, similaridade semântica

5. **Relatório executivo** — versão resumida para apresentação às editoras, com comparativos de custo/tempo vs. processo tradicional

---

## 6. NOTAS TÉCNICAS DE IMPLEMENTAÇÃO

### 6.1 Pacotes R Necessários

**Core AIGENIE:**
```r
install.packages(c("reticulate", "ggplot2", "igraph", "patchwork",
                   "tm", "R.utils", "jsonlite", "EGAnet"))
install.packages("AIGENIE",
  repos = c("https://laralee.r-universe.dev", "https://cloud.r-project.org"))
```

**IRT e Linking:**
```r
install.packages(c("mirt", "equateIRT", "sirt", "eRm"))
```

**Predição de Dificuldade por ML:**
```r
install.packages(c("glmnet", "randomForest", "e1071", "rpart",
                   "quanteda", "neuralnet"))
```

**Processamento de Texto em PT-BR:**
```r
install.packages(c("udpipe", "koRpus"))
# Para Coh-Metrix-Port: verificar disponibilidade atual
```

### 6.2 Modelos Recomendados

**Para geração de itens em português:**
- GPT-5.1 ou GPT-4o (OpenAI) — melhor qualidade
- Claude Opus 4 (Anthropic) — alternativa de alta qualidade
- Llama 3.3-70b via Groq — opção gratuita para testes

**Para embeddings:**
- text-embedding-3-small (OpenAI) — padrão recomendado pelo AIGENIE
- jina-embeddings-v4 (Jina AI) — alternativa multilíngue

**Para respondentes sintéticos (ensemble):**
- GPT-3.5 + GPT-4 + Llama 3 (mínimo de 3 modelos diferentes)
- Idealmente: 5-6 modelos de diferentes famílias

### 6.3 Adaptações para Português Brasileiro

**Sistema de role:**
```r
system.role <- "Você é um psicometrista expert especializado em 
  desenvolvimento de instrumentos de avaliação psicológica para 
  a população brasileira. Você escreve itens claros, precisos e 
  adequados culturalmente para adultos brasileiros."
```

**Prompt.notes:**
```r
prompt.notes <- "Todos os itens devem ser escritos em português brasileiro 
  formal, adequados para aplicação em contexto clínico/organizacional. 
  Evite regionalismos ou gírias. Nível de leitura: ensino médio completo."
```

**Corpus para features textuais:**
- brWaC (Brazilian Web as Corpus): http://www.nilc.icmc.usp.br/brwac/
- AC/DC: http://www.linguateca.pt/ACDC/
- Corpus do Português (Mark Davies): https://www.corpusdoportugues.org/

### 6.4 Restrições da Licença AGPL-3

O AIGENIE é licenciado sob AGPL-3. Implicações:
- **Uso interno (para si mesmo):** Permitido sem restrições
- **Prestação de serviço (SaaS):** Zona cinza — a AGPL cobre distribuição de software, mas o conceito de "serviço via rede" é interpretado de forma variada
- **Recomendação:** Operar como prestador de serviço (entrega de produtos, não de software) minimiza o risco
- **Alternativa de longo prazo:** Negociar licença comercial com os autores (Russell-Lasalandra / Golino / Christensen) — são acadêmicos, podem estar abertos a acordos

---

## 7. PERGUNTAS ABERTAS E PRÓXIMOS PASSOS

### 7.1 Questões Técnicas Ainda Abertas

- [ ] Definir tecnologia do front-end (Shiny vs. web app dedicado)
- [ ] Validar se há corpus de português adequado para as features textuais do Štěpánek
- [ ] Testar se LLMs em português geram itens de qualidade equivalente ao inglês
- [ ] Definir o design de formas para o Estágio 5 (quantos itens âncora, quantas formas)
- [ ] Avaliar custo por projeto (APIs + recrutamento empírico mínimo)
- [ ] Investigar se o Coh-Metrix-Port tem implementação R disponível

### 7.2 Questões de Negócio Ainda Abertas

- [ ] Qual editora escolher para o piloto (Hogrefe? Vetor?)
- [ ] Há relacionamento pré-existente com alguma delas?
- [ ] Qual teste do catálogo delas teria o problema mais visível a ser resolvido?
- [ ] Qual o preço por produto? (precificação a definir com base em custo + valor entregue)
- [ ] Como posicionar o produto frente às exigências do SATEPSI/CFP 31/2022?

### 7.3 Literatura a Buscar / Ler

- [ ] He-Yueya et al. (2024) — *Fully synthetic responses by GPT for item calibration* (citado em Liu et al.)
- [ ] Lu & Wang (2024) — *Generative student profiles for item development* (citado em Liu et al.)
- [ ] Russell-Lasalandra & Golino (2026) — *Prompt engineering for scale development in generative psychometrics* (arXiv:2603.15909)
- [ ] Garrido et al. (2025) — *Estimating dimensional structure in generative psychometrics: Comparing PCA and network methods* (PsyArXiv)
- [ ] Literatura sobre Coh-Metrix-Port para legibilidade em português
- [ ] Literatura sobre CAT no contexto brasileiro

---

## 8. REFERÊNCIAS BIBLIOGRÁFICAS COMPLETAS

Russell-Lasalandra, L. L., Christensen, A. P., & Golino, H. (2024). *Generative psychometrics via AI-GENIE: Automatic item generation and validation via network-integrated evaluation*. PsyArXiv Preprints.

Russell-Lasalandra, L. L., & Golino, H. (2026). *Prompt engineering for scale development in generative psychometrics*. arXiv preprint arXiv:2603.15909.

Garrido, L. E., Russell-Lasalandra, L., & Golino, H. (2025). *Estimating dimensional structure in generative psychometrics: Comparing PCA and network methods using large language model item embeddings*. PsyArXiv Preprints.

Bhandari, S., Liu, Y., Kwak, Y., & Pardos, Z. A. (2024). Evaluating the psychometric properties of ChatGPT-generated questions. *Computers and Education: Artificial Intelligence, 7*, 100284. https://doi.org/10.1016/j.caeai.2024.100284

Štěpánek, L., Dlouhá, J., & Martinková, P. (2023). Item difficulty prediction using item text features: Comparison of predictive performance across machine-learning algorithms. *Mathematics, 11*(19), 4104. https://doi.org/10.3390/math11194104

Rujas, M., Gómez del Moral Herranz, R. M., Fico, G., & Merino-Barbancho, B. (2025). Synthetic data generation in healthcare: A scoping review of reviews on domains, motivations, and future applications. *International Journal of Medical Informatics, 195*, 105763. https://doi.org/10.1016/j.ijmedinf.2024.105763

Licato, J., & Laverghetta, A. V. Jr. (2024). *Automatically creating psychometrically valid and reliable items using generative language models* (US Patent Application No. 2024/0339042 A1). United States Patent and Trademark Office.

Liu, Y., Bhandari, S., & Pardos, Z. A. (2025). Leveraging LLM respondents for item evaluation: A psychometric analysis. *British Journal of Educational Technology*. https://doi.org/10.1111/bjet.13570

[Anon] (2026). *Psychometric item validation using virtual respondents with trait-response mediators*. arXiv:2507.05890.

Savage, N. (2023). Synthetic data could be better than real data. *Nature Outlook*. https://www.nature.com/articles/d41586-023-01445-8

Golino, H. F., & Epskamp, S. (2017). Exploratory graph analysis: A new approach for estimating the number of dimensions in psychological research. *PLoS ONE, 12*(6), e0174035.

Christensen, A. P., Garrido, L. E., & Golino, H. (2023). Unique variable analysis: A network psychometrics method to detect local dependence. *Multivariate Behavioral Research, 58*(6), 1165–1182.

---

## 9. GLOSSÁRIO TÉCNICO

| Termo | Definição |
|---|---|
| **AIGENIE** | R package: Automatic Item Generation with Network-Integrated Evaluation |
| **EGA** | Exploratory Graph Analysis — método de psicometria em rede para estimar dimensionalidade |
| **UVA** | Unique Variable Analysis — detecta redundância semântica entre itens |
| **bootEGA** | Bootstrap EGA — avalia estabilidade de itens e dimensões via reamostras |
| **NMI** | Normalized Mutual Information — métrica de acurácia da detecção de comunidades (0-100%) |
| **wTO** | Weighted Topological Overlap — métrica de sobreposição usada pelo UVA |
| **IRT** | Item Response Theory — teoria de resposta ao item |
| **Rasch** | Modelo IRT de 1 parâmetro (dificuldade apenas) |
| **2PL** | Modelo IRT de 2 parâmetros (dificuldade + discriminação) |
| **CAT** | Computerized Adaptive Testing — testagem adaptativa computadorizada |
| **Linking/Equating** | Colocação de itens de diferentes formas em uma escala comum |
| **Âncora** | Itens comuns entre formas, usados para linking |
| **SATEPSI** | Sistema de Avaliação de Testes Psicológicos do CFP |
| **CFP** | Conselho Federal de Psicologia |
| **AGPL-3** | GNU Affero General Public License v3 — licença open source restritiva |
| **Embedding** | Representação vetorial numérica de alta dimensão de texto |
| **Cosine similarity** | Similaridade entre vetores — 1 = idênticos, 0 = ortogonais |
| **Elastic net** | Regressão regularizada combinando LASSO (L1) e Ridge (L2) |
| **Random forest** | Ensemble de árvores de decisão — melhor classificador no estudo de dificuldade |
| **RMSE** | Root Mean Square Error — métrica de erro de predição |
| **Forma alternativa paralela** | Versão de um teste que mede o mesmo construto com itens diferentes |
| **In silico** | Validação por computação, sem coleta de dados humanos |
| **Generative Psychometrics** | Campo emergente que usa IA generativa para desenvolvimento de escalas |

---

*Documento gerado ao final da sessão de planejamento em 03/05/2026.*  
*Continuar no Claude Code com este documento como contexto de referência.*
