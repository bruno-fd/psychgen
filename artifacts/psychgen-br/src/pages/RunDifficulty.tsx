import { useParams, Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRunDifficultyStage, useGetProject } from "@workspace/api-client-react";
import { 
  RunDifficultyStageBody, 
  runDifficultyStageBodyParamsAlgorithmDefault,
  runDifficultyStageBodyParamsCrossValidationFoldsDefault,
  runDifficultyStageBodyParamsUseTextFeaturesDefault,
  runDifficultyStageBodyParamsUseEmbeddingFeaturesDefault,
  runDifficultyStageBodyParamsEmbeddingModelDefault
} from "@workspace/api-zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Play, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function RunDifficulty() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: project, isLoading: isLoadingProject } = useGetProject(id);
  const runStage = useRunDifficultyStage();

  const form = useForm<z.infer<typeof RunDifficultyStageBody>>({
    resolver: zodResolver(RunDifficultyStageBody),
    defaultValues: {
      params: {
        algorithm: runDifficultyStageBodyParamsAlgorithmDefault,
        crossValidationFolds: runDifficultyStageBodyParamsCrossValidationFoldsDefault,
        useTextFeatures: runDifficultyStageBodyParamsUseTextFeaturesDefault,
        useEmbeddingFeatures: runDifficultyStageBodyParamsUseEmbeddingFeaturesDefault,
        embeddingModel: runDifficultyStageBodyParamsEmbeddingModelDefault
      }
    }
  });

  function onSubmit(values: z.infer<typeof RunDifficultyStageBody>) {
    runStage.mutate({ id, data: values }, {
      onSuccess: (job) => {
        toast({ title: "Predição de Dificuldade Iniciada", description: "O processo foi colocado na fila." });
        setLocation(`/jobs/${job.id}`);
      },
      onError: () => {
        toast({ title: "Erro", description: "Não foi possível iniciar o estágio.", variant: "destructive" });
      }
    });
  }

  if (isLoadingProject) {
    return <div className="space-y-6"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href={`/projects/${id}`}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estimar Dificuldade</h1>
          <p className="text-muted-foreground">Projeto: {project?.name} • Predição via Machine Learning</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Modelo</CardTitle>
              <CardDescription>Parâmetros para o treinamento do modelo de predição de dificuldade</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  
                  <FormField
                    control={form.control}
                    name="params.algorithm"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Algoritmo de Predição</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0 border p-3 rounded-md">
                              <FormControl>
                                <RadioGroupItem value="glmnet" />
                              </FormControl>
                              <div className="space-y-1">
                                <FormLabel className="font-normal cursor-pointer text-sm">GLMNet (Elastic Net)</FormLabel>
                                <FormDescription className="text-xs">Regressão penalizada, excelente para features textuais de alta dimensionalidade.</FormDescription>
                              </div>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0 border p-3 rounded-md">
                              <FormControl>
                                <RadioGroupItem value="randomForest" />
                              </FormControl>
                              <div className="space-y-1">
                                <FormLabel className="font-normal cursor-pointer text-sm">Random Forest</FormLabel>
                                <FormDescription className="text-xs">Modelo não-linear robusto baseado em árvores de decisão.</FormDescription>
                              </div>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0 border p-3 rounded-md">
                              <FormControl>
                                <RadioGroupItem value="ensemble" />
                              </FormControl>
                              <div className="space-y-1">
                                <FormLabel className="font-normal cursor-pointer text-sm">Ensemble (Recomendado)</FormLabel>
                                <FormDescription className="text-xs">Combina GLMNet e Random Forest para maior precisão preditiva.</FormDescription>
                              </div>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="params.crossValidationFolds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex justify-between">
                          <span>Folds de Validação Cruzada (k-fold)</span>
                          <span className="text-muted-foreground">{field.value}</span>
                        </FormLabel>
                        <FormControl>
                          <Slider min={2} max={20} step={1} value={[field.value || 5]} onValueChange={(v) => field.onChange(v[0])} />
                        </FormControl>
                        <FormDescription>Recomendado: 5 a 10.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Seleção de Features</h3>
                    <div className="grid gap-4">
                      <FormField
                        control={form.control}
                        name="params.useTextFeatures"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Features Linguísticas Base (Text Features)</FormLabel>
                              <FormDescription>
                                Utilizar contagem de palavras, sílabas, complexidade sintática e legibilidade (Flesch).
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="params.useEmbeddingFeatures"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Embeddings Semânticos</FormLabel>
                              <FormDescription>
                                Extrair vetores semânticos profundos do modelo de linguagem.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {form.watch("params.useEmbeddingFeatures") && (
                    <FormField
                      control={form.control}
                      name="params.embeddingModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modelo de Embeddings</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="text-embedding-3-large">text-embedding-3-large (Recomendado)</SelectItem>
                              <SelectItem value="text-embedding-3-small">text-embedding-3-small</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="flex justify-end gap-4 pt-6 border-t">
                    <Link href={`/projects/${id}`}>
                      <Button type="button" variant="ghost">Cancelar</Button>
                    </Link>
                    <Button type="submit" disabled={runStage.isPending} className="gap-2">
                      {runStage.isPending ? "Iniciando..." : <><Play className="h-4 w-4" /> Estimar Dificuldade</>}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" /> Estimação de Dificuldade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                O segundo estágio do framework aplica modelos de <em>Machine Learning</em> em R (via <code>caret</code> e <code>glmnet</code>) para prever a dificuldade (parâmetro b da TRI) de cada item antes mesmo da aplicação empírica.
              </p>
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">Features Linguísticas</h4>
                <p>O texto do item é analisado para extrair métricas clássicas de complexidade: comprimento, frequência de palavras raras, e índices de legibilidade.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">Embeddings</h4>
                <p>As representações latentes densas da API da OpenAI capturam a semântica fina e correlações que escapam às métricas linguísticas de superfície.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">Algoritmos</h4>
                <p>O uso de <strong>Ensemble</strong> combina a robustez da regressão penalizada (Elastic Net) com o poder não-linear do Random Forest, mitigando o sobreajuste.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
