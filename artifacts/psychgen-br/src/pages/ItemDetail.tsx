import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetItem, useUpdateItem, getGetItemQueryKey, getListProjectItemsQueryKey } from "@workspace/api-client-react";
import { UpdateItemBody } from "@workspace/api-zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Activity, Network } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatDate } from "@/lib/formatters";

export default function ItemDetail() {
  const params = useParams();
  const id = Number(params.itemId);
  const projectId = Number(params.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: item, isLoading } = useGetItem(id);
  const updateItem = useUpdateItem();

  const form = useForm<z.infer<typeof UpdateItemBody>>({
    resolver: zodResolver(UpdateItemBody),
    defaultValues: {
      text: "",
      status: "generated",
      humanNotes: "",
      construct: "",
      dimension: ""
    }
  });

  useEffect(() => {
    if (item) {
      form.reset({
        text: item.text,
        status: item.status,
        humanNotes: item.humanNotes || "",
        construct: item.construct || "",
        dimension: item.dimension || ""
      });
    }
  }, [item, form]);

  const onSubmit = (values: z.infer<typeof UpdateItemBody>) => {
    updateItem.mutate({ id, data: values }, {
      onSuccess: () => {
        toast({ title: "Item atualizado", description: "As alterações foram salvas com sucesso." });
        queryClient.invalidateQueries({ queryKey: getGetItemQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListProjectItemsQueryKey(projectId) });
      },
      onError: () => {
        toast({ title: "Erro", description: "Não foi possível atualizar o item.", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  if (!item) return <div className="py-12 text-center text-muted-foreground">Item não encontrado.</div>;

  const difficultyData = [
    { name: 'Predita (ML)', value: item.difficultyPredicted || 0, fill: 'hsl(var(--chart-1))' },
    { name: 'Estimada (IRT)', value: item.difficultyEstimated || 0, fill: 'hsl(var(--chart-2))' }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'generated': return <Badge variant="outline">Gerado</Badge>;
      case 'needs_review': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Revisão Pendente</Badge>;
      case 'approved': return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Aprovado</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejeitado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">Item #{item.id}</h1>
              {getStatusBadge(item.status)}
            </div>
            <p className="text-sm text-muted-foreground">
              Projeto: <Link href={`/projects/${projectId}`} className="hover:underline">ID-{projectId}</Link> • Gerado por: {item.generatedBy} • {formatDate(item.createdAt, "dd/MM/yyyy HH:mm")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Edição do Item</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Texto do Item</FormLabel>
                        <FormControl>
                          <Textarea className="min-h-[100px] text-lg" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="construct"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Construto</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dimension"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dimensão</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status de Revisão</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="generated">Gerado</SelectItem>
                              <SelectItem value="needs_review">Revisão Pendente</SelectItem>
                              <SelectItem value="approved">Aprovado</SelectItem>
                              <SelectItem value="rejected">Rejeitado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="humanNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notas da Revisão Humana (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Observações sobre adaptação cultural, clareza, etc." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-4 pt-4 border-t">
                    <Button type="button" variant="ghost" onClick={() => form.reset()}>Reverter</Button>
                    <Button type="submit" disabled={updateItem.isPending} className="gap-2">
                      <Save className="h-4 w-4" /> {updateItem.isPending ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Parâmetros Psicométricos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-medium mb-4">Dificuldade (Parâmetro b)</h4>
                {item.difficultyPredicted === null && item.difficultyEstimated === null ? (
                  <div className="text-sm text-muted-foreground italic bg-muted/50 p-4 rounded text-center">Nenhum dado de dificuldade disponível.</div>
                ) : (
                  <div className="h-[120px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={difficultyData} layout="vertical" margin={{ left: 80, right: 20, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={['-3', '3']} />
                        <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11}} />
                        <Tooltip formatter={(value: number) => value.toFixed(3)} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-3 rounded-lg border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Discriminação (a)</div>
                  <div className="text-xl font-semibold">
                    {item.discrimination !== null ? item.discrimination?.toFixed(3) : '-'}
                  </div>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Acerto Casual (c)</div>
                  <div className="text-xl font-semibold">
                    {item.guessing !== null ? item.guessing?.toFixed(3) : '-'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Network className="h-5 w-5 text-primary" /> Exploratory Graph Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {item.egaCommunity !== null ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-muted-foreground">Comunidade Detectada:</span>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="px-3 py-1 text-sm bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                      Comunidade {item.egaCommunity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Comunidades EGA indicam agrupamentos empíricos de itens baseados em similaridade semântica profunda, servindo como proxy para dimensionalidade teórica.
                  </p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic bg-muted/50 p-4 rounded text-center">
                  Item ainda não submetido à validação de rede EGA global.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
