import { useParams, Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRunIrtStage, useGetProject } from "@workspace/api-client-react";
import { 
  RunIrtStageBody, 
  runIrtStageBodyParamsModelsDefault,
  runIrtStageBodyParamsSyntheticNDefault,
  runIrtStageBodyParamsIrtModelDefault,
  runIrtStageBodyParamsTemperatureDefault,
  runIrtStageBodyParamsResponseFormatDefault
} from "@workspace/api-zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Play, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const MODELS = [
  { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" }
] as const;

export default function RunIrt() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: project, isLoading: isLoadingProject } = useGetProject(id);
  const runStage = useRunIrtStage();

  const form = useForm<z.infer<typeof RunIrtStageBody>>({
    resolver: zodResolver(RunIrtStageBody),
    defaultValues: {
      params: {
        models: runIrtStageBodyParamsModelsDefault as string[],
        syntheticN: runIrtStageBodyParamsSyntheticNDefault,
        irtModel: runIrtStageBodyParamsIrtModelDefault,
        personaSeed: "",
        temperature: runIrtStageBodyParamsTemperatureDefault,
        responseFormat: runIrtStageBodyParamsResponseFormatDefault
      }
    }
  });

  function onSubmit(values: z.infer<typeof RunIrtStageBody>) {
    runStage.mutate({ id, data: values }, {
      onSuccess: (job) => {
        toast({ title: "Calibração IRT Iniciada", description: "O processo foi colocado na fila." });
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
          <h1 className="text-2xl font-bold tracking-tight">Calibração IRT</h1>
          <p className="text-muted-foreground">Projeto: {project?.name} • Teoria de Resposta ao Item</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Calibração</CardTitle>
              <CardDescription>Parâmetros para a simulação de respondentes sintéticos</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  
                  <FormField
                    control={form.control}
                    name="params.models"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">Modelos de Persona (Ensemble)</FormLabel>
                          <FormDescription>
                            Selecione os LLMs que atuarão como respondentes sintéticos.
                          </FormDescription>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {MODELS.map((model) => (
                            <FormField
                              key={model.id}
                              control={form.control}
                              name="params.models"
                              render={({ field }) => {
                                return (
                                  <FormItem
                                    key={model.id}
                                    className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(model.id)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...(field.value || []), model.id])
                                            : field.onChange(
                                                field.value?.filter(
                                                  (value: string) => value !== model.id
                                                )
                                              )
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal cursor-pointer text-sm">
                                      {model.label}
                                    </FormLabel>
                                  </FormItem>
                                )
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="params.syntheticN"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex justify-between">
                            <span>Amostra Sintética (N)</span>
                            <span className="text-muted-foreground">{field.value}</span>
                          </FormLabel>
                          <FormControl>
                            <Slider min={50} max={5000} step={50} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} />
                          </FormControl>
                          <FormDescription>Número de "pessoas" virtuais.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="params.temperature"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex justify-between">
                            <span>Temperature das Personas</span>
                            <span className="text-muted-foreground">{field.value}</span>
                          </FormLabel>
                          <FormControl>
                            <Slider min={0} max={2} step={0.05} value={[field.value || 1]} onValueChange={(v) => field.onChange(v[0])} />
                          </FormControl>
                          <FormDescription>Controla a variância das respostas.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="params.irtModel"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Modelo IRT Matemático</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0 border p-3 rounded-md">
                              <FormControl>
                                <RadioGroupItem value="Rasch" />
                              </FormControl>
                              <div className="space-y-1">
                                <FormLabel className="font-normal cursor-pointer text-sm">Rasch (1PL)</FormLabel>
                                <FormDescription className="text-xs">Apenas parâmetro de dificuldade (b).</FormDescription>
                              </div>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0 border p-3 rounded-md">
                              <FormControl>
                                <RadioGroupItem value="2PL" />
                              </FormControl>
                              <div className="space-y-1">
                                <FormLabel className="font-normal cursor-pointer text-sm">2PL</FormLabel>
                                <FormDescription className="text-xs">Dificuldade (b) e Discriminação (a).</FormDescription>
                              </div>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0 border p-3 rounded-md">
                              <FormControl>
                                <RadioGroupItem value="3PL" />
                              </FormControl>
                              <div className="space-y-1">
                                <FormLabel className="font-normal cursor-pointer text-sm">3PL</FormLabel>
                                <FormDescription className="text-xs">Dificuldade, Discriminação e Acerto ao acaso (c).</FormDescription>
                              </div>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0 border p-3 rounded-md">
                              <FormControl>
                                <RadioGroupItem value="graded" />
                              </FormControl>
                              <div className="space-y-1">
                                <FormLabel className="font-normal cursor-pointer text-sm">Graded Response Model (GRM)</FormLabel>
                                <FormDescription className="text-xs">Para escalas Likert (politômicas).</FormDescription>
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
                    name="params.responseFormat"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Formato de Resposta</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="likert5" />
                              </FormControl>
                              <FormLabel className="font-normal">Likert 5 pontos</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="likert7" />
                              </FormControl>
                              <FormLabel className="font-normal">Likert 7 pontos</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="dichotomous" />
                              </FormControl>
                              <FormLabel className="font-normal">Dicotômico (Certo/Errado)</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="params.personaSeed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Semente da Persona (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Ex: Instrua o LLM a simular estudantes universitários com diferentes níveis de ansiedade..." 
                            className="min-h-[80px]" 
                            {...field} 
                            value={field.value || ""} 
                          />
                        </FormControl>
                        <FormDescription>Prompt base para a geração dos perfis sintéticos.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-4 pt-6 border-t">
                    <Link href={`/projects/${id}`}>
                      <Button type="button" variant="ghost">Cancelar</Button>
                    </Link>
                    <Button type="submit" disabled={runStage.isPending} className="gap-2">
                      {runStage.isPending ? "Iniciando..." : <><Play className="h-4 w-4" /> Iniciar Calibração IRT</>}
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
                <Info className="h-5 w-5 text-primary" /> Calibração Sintética
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Este estágio realiza a calibração dos itens baseada na <strong>Teoria de Resposta ao Item (TRI / IRT)</strong> utilizando respondentes gerados por LLM.
              </p>
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">Personas</h4>
                <p>O sistema gera <em>N</em> perfis sintéticos com diferentes níveis de traço latente (theta). O uso de um ensemble de modelos LLM (ex: combinando GPT e Claude) mitiga vieses específicos de um único modelo.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">Pacote mirt (R)</h4>
                <p>As respostas sintéticas são então processadas usando o consagrado pacote <code>mirt</code> no R para estimar os parâmetros psicométricos com rigor matemático.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
