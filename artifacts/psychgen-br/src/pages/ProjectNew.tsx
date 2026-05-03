import { useCreateProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { CreateProjectBody } from "@workspace/api-zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Beaker } from "lucide-react";
import { Link } from "wouter";

export default function ProjectNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProject = useCreateProject();

  const form = useForm<z.infer<typeof CreateProjectBody>>({
    resolver: zodResolver(CreateProjectBody),
    defaultValues: {
      name: "",
      construct: "",
      description: "",
      language: "pt-BR",
      targetAudience: "",
      publisher: "",
    },
  });

  function onSubmit(values: z.infer<typeof CreateProjectBody>) {
    createProject.mutate({ data: values }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({
          title: "Projeto criado",
          description: "Projeto configurado com sucesso.",
        });
        setLocation(`/projects/${data.id}`);
      },
      onError: () => {
        toast({
          title: "Erro",
          description: "Não foi possível criar o projeto.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Projeto Psicométrico</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            Parâmetros do Instrumento
          </CardTitle>
          <CardDescription>
            Defina o domínio psicológico e contexto de aplicação para guiar a geração de itens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Projeto</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Inventário de Resiliência" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="construct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Construto (Domínio)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Resiliência Emocional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição / Referencial Teórico</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Definição constitutiva do construto..." 
                        className="min-h-[100px]"
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="targetAudience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Público-Alvo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Adultos, Ensino Superior" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Idioma</FormLabel>
                      <FormControl>
                        <Input disabled {...field} />
                      </FormControl>
                      <FormDescription>Fixo em pt-BR</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="publisher"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Editora / Laboratório (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Hogrefe, Vetor" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Link href="/projects">
                  <Button type="button" variant="ghost">Cancelar</Button>
                </Link>
                <Button type="submit" disabled={createProject.isPending}>
                  {createProject.isPending ? "Criando..." : "Criar Projeto"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
