import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRunAigenieStage, useGetProject } from "@workspace/api-client-react";
import { 
  RunAigenieStageBody, 
  runAigenieStageBodyParamsModelDefault,
  runAigenieStageBodyParamsTemperatureDefault,
  runAigenieStageBodyParamsTopPDefault,
  runAigenieStageBodyParamsTargetNDefault,
  runAigenieStageBodyParamsAdaptiveDefault,
  runAigenieStageBodyParamsAllTogetherDefault,
  runAigenieStageBodyParamsRunOverallDefault,
  runAigenieStageBodyParamsEmbeddingModelDefault,
  runAigenieStageBodyParamsEgaThresholdDefault
} from "@workspace/api-zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Play, Info, Plus, X } from "lucide-react";
import { RScriptPreview } from "@/components/r-script-preview";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function RunAigenie() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: project, isLoading: isLoadingProject } = useGetProject(id);
  const runStage = useRunAigenieStage();

  const form = useForm<z.infer<typeof RunAigenieStageBody>>({
    resolver: zodResolver(RunAigenieStageBody),
    defaultValues: {
      params: {
        model: runAigenieStageBodyParamsModelDefault,
        temperature: runAigenieStageBodyParamsTemperatureDefault,
        topP: runAigenieStageBodyParamsTopPDefault,
        targetN: runAigenieStageBodyParamsTargetNDefault,
        adaptive: runAigenieStageBodyParamsAdaptiveDefault,
        allTogether: runAigenieStageBodyParamsAllTogetherDefault,
        runOverall: runAigenieStageBodyParamsRunOverallDefault,
        systemRole: "",
        promptNotes: "",
        itemAttributes: [""],
        itemExamples: [""],
        embeddingModel: runAigenieStageBodyParamsEmbeddingModelDefault,
        egaThreshold: runAigenieStageBodyParamsEgaThresholdDefault
      }
    }
  });

  const { fields: attributeFields, append: appendAttribute, remove: removeAttribute } = useFieldArray({
    control: form.control,
    name: "params.itemAttributes" as never, // cast due to generic string array typing issue
  });

  const { fields: exampleFields, append: appendExample, remove: removeExample } = useFieldArray({
    control: form.control,
    name: "params.itemExamples" as never,
  });

  function onSubmit(values: z.infer<typeof RunAigenieStageBody>) {
    // Clean up empty strings from arrays
    const cleanedValues = {
      params: {
        ...values.params,
        itemAttributes: (values.params.itemAttributes as string[])?.filter(a => a.trim() !== "") || [],
        itemExamples: (values.params.itemExamples as string[])?.filter(e => e.trim() !== "") || [],
      }
    };

    runStage.mutate({ id, data: cleanedValues }, {
      onSuccess: (job) => {
        toast({ title: "AIGENIE Iniciado", description: "O processo foi colocado na fila." });
        setLocation(`/jobs/${job.id}`);
      },
      onError: () => {
        toast({ title: "Erro", description: "Não foi possível iniciar o estágio.", variant: "destructive" });
      }
    });
  }

  if (isLoadingProject) {
    return <div className="space-y-6"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-[600px] w-full" /></div>;
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
          <h1 className="text-2xl font-bold tracking-tight">Executar AIGENIE</h1>
          <p className="text-muted-foreground">Projeto: {project?.name} • Geração de Itens</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Geração</CardTitle>
              <CardDescription>Parâmetros para o processo iterativo do AIGENIE</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  {/* Model Settings */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Modelo e Sampling</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="params.model"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Modelo LLM Base</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione um modelo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="gpt-4o">GPT-4o (Recomendado)</SelectItem>
                                <SelectItem value="gpt-4o-mini">GPT-4o Mini (Rápido)</SelectItem>
                                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                                <SelectItem value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet</SelectItem>
                                <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="params.targetN"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantidade de Itens (N)</FormLabel>
                            <FormControl>
                              <Input type="number" min={5} max={200} {...field} onChange={e => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid sm:grid-cols-2 gap-6 pt-4">
                      <FormField
                        control={form.control}
                        name="params.temperature"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex justify-between">
                              <span>Temperature</span>
                              <span className="text-muted-foreground">{field.value}</span>
                            </FormLabel>
                            <FormControl>
                              <Slider min={0} max={2} step={0.05} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="params.topP"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex justify-between">
                              <span>Top P</span>
                              <span className="text-muted-foreground">{field.value}</span>
                            </FormLabel>
                            <FormControl>
                              <Slider min={0} max={1} step={0.01} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Execution Modes */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Modos de Execução</h3>
                    <div className="grid gap-4">
                      <FormField
                        control={form.control}
                        name="params.adaptive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Modo Adaptativo (Iterativo)</FormLabel>
                              <FormDescription>
                                Se ativado, gera itens em lotes e os submete ao crivo do EGA iterativamente.
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
                        name="params.allTogether"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Agrupar Contexto (All Together)</FormLabel>
                              <FormDescription>
                                Passa todos os itens gerados previamente no contexto do LLM a cada iteração.
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
                        name="params.runOverall"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Avaliação Global (Run Overall)</FormLabel>
                              <FormDescription>
                                Executa a análise EGA (Exploratory Graph Analysis) no pool completo ao final.
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

                  {/* Prompt Customization */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Customização de Prompt</h3>
                    <FormField
                      control={form.control}
                      name="params.systemRole"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Papel do Sistema (Opcional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Ex: Você é um psicometrista especialista em escalas de personalidade..." className="min-h-[80px]" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormDescription>Sobrescreve a persona padrão do AIGENIE.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="params.promptNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notas Adicionais para o Prompt (Opcional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Ex: Evite itens com dupla negativa. Use linguagem acessível para o ensino médio." className="min-h-[80px]" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Attributes and Examples */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Atributos e Exemplos</h3>
                    
                    <div>
                      <Label className="mb-2 block">Atributos Obrigatórios (Restrições)</Label>
                      {attributeFields.map((field, index) => (
                        <FormField
                          key={field.id}
                          control={form.control}
                          name={`params.itemAttributes.${index}` as never}
                          render={({ field: inputField }) => (
                            <FormItem className="mb-2">
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input placeholder={`Atributo ${index + 1}`} {...inputField} />
                                </FormControl>
                                <Button type="button" variant="outline" size="icon" onClick={() => removeAttribute(index)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendAttribute("")}>
                        <Plus className="h-4 w-4 mr-2" /> Adicionar Atributo
                      </Button>
                    </div>

                    <div className="pt-4">
                      <Label className="mb-2 block">Exemplos de Itens (Few-Shot)</Label>
                      {exampleFields.map((field, index) => (
                        <FormField
                          key={field.id}
                          control={form.control}
                          name={`params.itemExamples.${index}` as never}
                          render={({ field: inputField }) => (
                            <FormItem className="mb-2">
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input placeholder={`Exemplo ${index + 1}`} {...inputField} />
                                </FormControl>
                                <Button type="button" variant="outline" size="icon" onClick={() => removeExample(index)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendExample("")}>
                        <Plus className="h-4 w-4 mr-2" /> Adicionar Exemplo
                      </Button>
                    </div>
                  </div>

                  {/* Embeddings and Thresholds */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Validação EGA (Exploratory Graph Analysis)</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
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
                      <FormField
                        control={form.control}
                        name="params.egaThreshold"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex justify-between">
                              <span>Limiar EGA (Threshold)</span>
                              <span className="text-muted-foreground">{field.value}</span>
                            </FormLabel>
                            <FormControl>
                              <Slider min={0} max={1} step={0.01} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} />
                            </FormControl>
                            <FormDescription>Correlação mínima para retenção.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-6 border-t">
                    <Link href={`/projects/${id}`}>
                      <Button type="button" variant="ghost">Cancelar</Button>
                    </Link>
                    <Button type="submit" disabled={runStage.isPending} className="gap-2">
                      {runStage.isPending ? "Iniciando..." : <><Play className="h-4 w-4" /> Iniciar AIGENIE</>}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Right column: live R syntax preview + how-it-works */}
        <div className="space-y-6">
          <RScriptPreview
            projectId={id}
            stage="aigenie"
            params={form.watch("params")}
            filenamePrefix="aigenie"
          />
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" /> Como funciona o AIGENIE
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                O algoritmo <strong>AIGENIE</strong> é um framework de geração de itens iterativo que utiliza modelos de linguagem (LLM) acoplados a validações de similaridade semântica e <em>Exploratory Graph Analysis</em> (EGA).
              </p>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">1. Geração (Temperature & Top P)</h4>
                <p>Temperature mais alta (ex: 0.9) aumenta a diversidade dos itens. Top P controla o vocabulário base. O LLM usa a descrição do projeto para o contexto.</p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">2. Validação Adaptativa</h4>
                <p>Com o <strong>Modo Adaptativo</strong> ligado, o algoritmo gera lotes e extrai embeddings (representações vetoriais) de cada item. O limite do EGA dita quão coesos os itens devem ser para não serem descartados iterativamente.</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">3. All Together vs Run Overall</h4>
                <p><strong>All Together</strong> inclui o histórico no prompt para evitar duplicatas. <strong>Run Overall</strong> roda uma verificação final de dimensionalidade em toda a escala usando a rede de correlações (EGA).</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
