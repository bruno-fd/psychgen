import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useParams } from "wouter";
import {
  useGetProject,
  useRunSampleDesignStage,
} from "@workspace/api-client-react";
import {
  RunSampleDesignStageBody,
  runSampleDesignStageBodyParamsTargetSampleNDefault,
  runSampleDesignStageBodyParamsTargetThetaSEDefault,
  runSampleDesignStageBodyParamsShortlistMaxItemsDefault,
} from "@workspace/api-zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Info, Play, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_STRATA = [
  { label: "Sudeste — Ensino Médio", populationShare: 0.4, sampledN: 0 },
  { label: "Nordeste — Ensino Médio", populationShare: 0.3, sampledN: 0 },
  { label: "Sul — Ensino Médio", populationShare: 0.15, sampledN: 0 },
  { label: "Norte/Centro-Oeste — Ensino Médio", populationShare: 0.15, sampledN: 0 },
];

export default function RunSampleDesign() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: project, isLoading: isLoadingProject } = useGetProject(id);
  const runStage = useRunSampleDesignStage();

  const form = useForm<z.infer<typeof RunSampleDesignStageBody>>({
    resolver: zodResolver(RunSampleDesignStageBody),
    defaultValues: {
      params: {
        targetSampleN: runSampleDesignStageBodyParamsTargetSampleNDefault,
        targetThetaSE: runSampleDesignStageBodyParamsTargetThetaSEDefault,
        shortlistMaxItems: runSampleDesignStageBodyParamsShortlistMaxItemsDefault,
        strata: DEFAULT_STRATA,
      },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "params.strata",
  });

  const watchedStrata = form.watch("params.strata");
  const totalShare = watchedStrata?.reduce(
    (sum, s) => sum + (Number(s?.populationShare) || 0),
    0,
  );

  function onSubmit(values: z.infer<typeof RunSampleDesignStageBody>) {
    runStage.mutate(
      { id, data: values },
      {
        onSuccess: (job) => {
          toast({
            title: "Plano amostral iniciado",
            description: "Calculando pesos e shortlist no R.",
          });
          setLocation(`/jobs/${job.id}`);
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível iniciar o estágio.",
            variant: "destructive",
          });
        },
      },
    );
  }

  if (isLoadingProject) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
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
          <h1 className="text-2xl font-bold tracking-tight">
            Plano Amostral — Estágio 5
          </h1>
          <p className="text-muted-foreground">
            Projeto: {project?.name} • Pós-estratificação + shortlist por informação
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Parâmetros</CardTitle>
              <CardDescription>
                Estratos populacionais para pesos pós-estratificação e tamanho-alvo da amostra.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <div className="grid sm:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="params.targetSampleN"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>N alvo</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={30}
                              max={100000}
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              data-testid="input-target-n"
                            />
                          </FormControl>
                          <FormDescription>Tamanho da amostra final desejado.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="params.targetThetaSE"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SE(theta) alvo</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.05"
                              min={0.05}
                              max={1.0}
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              data-testid="input-target-se"
                            />
                          </FormControl>
                          <FormDescription>Erro-padrão máximo aceitável (logit).</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="params.shortlistMaxItems"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Itens no shortlist</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={5}
                              max={500}
                              value={field.value ?? 30}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              data-testid="input-shortlist"
                            />
                          </FormControl>
                          <FormDescription>Itens mais informativos.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <FormLabel className="text-base">Estratos populacionais</FormLabel>
                        <FormDescription>
                          Soma das proporções deve ser ≈ 1. Atualmente:{" "}
                          <strong className={Math.abs((totalShare ?? 0) - 1) < 0.01 ? "text-green-600" : "text-amber-600"}>
                            {(totalShare ?? 0).toFixed(3)}
                          </strong>
                        </FormDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append({ label: "", populationShare: 0.1, sampledN: 0 })}
                        className="gap-2"
                        data-testid="button-add-stratum"
                      >
                        <Plus className="h-4 w-4" /> Adicionar estrato
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {fields.map((f, idx) => (
                        <div key={f.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-start border rounded-md p-3">
                          <FormField
                            control={form.control}
                            name={`params.strata.${idx}.label`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Rótulo</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Ex: Sudeste — EM" data-testid={`input-stratum-label-${idx}`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`params.strata.${idx}.populationShare`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Proporção populacional</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    max={1}
                                    {...field}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`params.strata.${idx}.sampledN`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">N coletado (opc.)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={field.value ?? 0}
                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-6 text-destructive"
                            disabled={fields.length === 1}
                            onClick={() => remove(idx)}
                            data-testid={`button-remove-stratum-${idx}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-6 border-t">
                    <Link href={`/projects/${id}`}>
                      <Button type="button" variant="ghost">Cancelar</Button>
                    </Link>
                    <Button
                      type="submit"
                      disabled={runStage.isPending}
                      className="gap-2"
                      data-testid="button-submit-sample-design"
                    >
                      {runStage.isPending ? "Iniciando..." : <><Play className="h-4 w-4" /> Iniciar Plano Amostral</>}
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
                <Info className="h-5 w-5 text-primary" /> Plano amostral
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Este estágio combina os parâmetros IRT calibrados (estágio 3) com a
                composição populacional informada para produzir:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Pesos de pós-estratificação</strong> por estrato (corrigem viés amostral).</li>
                <li><strong>Shortlist de itens</strong> com maior informação na faixa de interesse de theta.</li>
                <li><strong>N efetivo recomendado</strong> para alcançar SE(θ) alvo, dado o pool de itens.</li>
              </ul>
              <p className="text-xs">Roda inteiramente em R via <code>mirt::testinfo</code>.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
