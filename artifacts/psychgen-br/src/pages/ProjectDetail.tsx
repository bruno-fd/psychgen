import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { 
  useGetProject, 
  useGetProjectPipeline, 
  useListProjectItems, 
  useListReports,
  useDeleteProject,
  getGetProjectQueryKey,
  getListProjectsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatDate, formatPercent } from "@/lib/formatters";
import { ArrowLeft, Settings, Trash2, Edit, Activity, Database, Play, CheckCircle2, XCircle, AlertCircle, FileText, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function ProjectDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: project, isLoading: isLoadingProject } = useGetProject(id);
  const { data: pipeline, isLoading: isLoadingPipeline } = useGetProjectPipeline(id);
  const { data: items, isLoading: isLoadingItems } = useListProjectItems(id);
  const { data: reports, isLoading: isLoadingReports } = useListReports({ projectId: id });

  const deleteProject = useDeleteProject();

  const handleDelete = () => {
    deleteProject.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Projeto excluído", description: "O projeto foi removido com sucesso." });
        setLocation("/projects");
      },
      onError: () => {
        toast({ title: "Erro", description: "Não foi possível excluir o projeto.", variant: "destructive" });
      }
    });
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'draft': return <Badge variant="outline">Rascunho</Badge>;
      case 'generating': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Gerando</Badge>;
      case 'calibrating': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Calibrando</Badge>;
      case 'ready': return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Pronto</Badge>;
      case 'archived': return <Badge variant="secondary">Arquivado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'generated': return <Badge variant="outline">Gerado</Badge>;
      case 'needs_review': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Revisão Pendente</Badge>;
      case 'approved': return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Aprovado</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejeitado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStageStatusColor = (status: string) => {
    switch(status) {
      case 'running': return 'text-blue-500';
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-destructive';
      case 'not_started': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const filteredItems = items?.filter(item => statusFilter === "all" || item.status === statusFilter) || [];

  if (isLoadingProject) {
    return <div className="space-y-4"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!project) return <div className="py-12 text-center text-muted-foreground">Projeto não encontrado.</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              {getStatusBadge(project.status)}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              ID-{project.id} • {project.construct}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* <Button variant="outline" size="sm" className="gap-2">
            <Edit className="h-4 w-4" /> Editar
          </Button> */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground gap-2">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Projeto</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza? Isso excluirá permanentemente o projeto "{project.name}", todos os seus itens, relatórios e processos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="items">Itens ({items?.length || 0})</TabsTrigger>
          <TabsTrigger value="reports">Relatórios ({reports?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Itens Gerados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{project.itemCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Aprovados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{project.approvedCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {project.itemCount ? formatPercent(project.approvedCount / project.itemCount) : '0%'} taxa de aprovação
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Última Atualização</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-medium">{formatDate(project.updatedAt, "dd/MM/yyyy HH:mm")}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalhes do Instrumento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="font-semibold text-muted-foreground">Público-Alvo:</span>
                <p className="mt-1">{project.targetAudience}</p>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Referencial Teórico / Descrição:</span>
                <p className="mt-1">{project.description || "Nenhuma descrição fornecida."}</p>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Editora / Laboratório:</span>
                <p className="mt-1">{project.publisher || "Não especificado"}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['aigenie', 'difficulty', 'irt'].map((stageKey) => {
              const stageData = pipeline?.stages.find(s => s.stage === stageKey);
              const status = stageData?.status || 'not_started';
              const latestJob = stageData?.latestJob;
              
              let title, description, linkUrl;
              switch (stageKey) {
                case 'aigenie':
                  title = "Estágio 1: AIGENIE";
                  description = "Geração de itens com LLM + Verificação EGA";
                  linkUrl = `/projects/${id}/run/aigenie`;
                  break;
                case 'difficulty':
                  title = "Estágio 2: Dificuldade";
                  description = "Previsão de dificuldade via Machine Learning";
                  linkUrl = `/projects/${id}/run/difficulty`;
                  break;
                case 'irt':
                  title = "Estágio 3: Calibração IRT";
                  description = "Calibração via respondentes sintéticos";
                  linkUrl = `/projects/${id}/run/irt`;
                  break;
              }

              return (
                <Card key={stageKey} className={`flex flex-col ${status === 'running' ? 'border-primary' : ''}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <CardTitle className="text-lg">{title}</CardTitle>
                      <Activity className={`h-5 w-5 ${getStageStatusColor(status)}`} />
                    </div>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    {isLoadingPipeline ? (
                      <Skeleton className="h-20 w-full" />
                    ) : latestJob ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Status do último processo:</span>
                          <Badge variant="outline">{latestJob.status}</Badge>
                        </div>
                        {latestJob.status === 'running' && (
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Progresso:</span>
                              <span>{Math.round(latestJob.progress * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${latestJob.progress * 100}%` }}></div>
                            </div>
                          </div>
                        )}
                        <Link href={`/jobs/${latestJob.id}`}>
                          <span className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1">
                            Ver processo <ChevronRight className="h-3 w-3" />
                          </span>
                        </Link>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground py-4 text-center bg-muted/50 rounded border border-dashed">
                        Nenhum processo executado
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-4 border-t">
                    <Link href={linkUrl!} className="w-full">
                      <Button className="w-full gap-2" variant={status === 'completed' ? 'outline' : 'default'} disabled={status === 'running'}>
                        <Play className="h-4 w-4" /> Executar Estágio
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="items" className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            {['all', 'generated', 'needs_review', 'approved', 'rejected'].map(f => (
              <Button 
                key={f} 
                variant={statusFilter === f ? "default" : "outline"} 
                size="sm"
                onClick={() => setStatusFilter(f)}
              >
                {f === 'all' ? 'Todos' : f === 'generated' ? 'Gerados' : f === 'needs_review' ? 'Revisão' : f === 'approved' ? 'Aprovados' : 'Rejeitados'}
              </Button>
            ))}
          </div>

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Texto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dimensão</TableHead>
                    <TableHead>Dif. (Pred)</TableHead>
                    <TableHead>Dif. (Est)</TableHead>
                    <TableHead>Discriminação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingItems ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Nenhum item encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLocation(`/projects/${id}/items/${item.id}`)}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{item.id}</TableCell>
                        <TableCell className="font-medium max-w-xs truncate" title={item.text}>{item.text}</TableCell>
                        <TableCell>{getItemStatusBadge(item.status)}</TableCell>
                        <TableCell className="text-sm">{item.dimension || '-'}</TableCell>
                        <TableCell className="text-sm">{item.difficultyPredicted?.toFixed(2) || '-'}</TableCell>
                        <TableCell className="text-sm">{item.difficultyEstimated?.toFixed(2) || '-'}</TableCell>
                        <TableCell className="text-sm">{item.discrimination?.toFixed(2) || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          {isLoadingReports ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : reports && reports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map((report) => (
                <Card key={report.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Relatório: {report.kind}
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">{formatDate(report.createdAt, "dd/MM/yy")}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-sm text-muted-foreground line-clamp-2">{report.summary}</p>
                  </CardContent>
                  <CardFooter>
                    <Link href={`/reports/${report.id}`}>
                      <Button variant="ghost" size="sm" className="gap-1">
                        Visualizar <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center border rounded-lg bg-card/50">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-medium">Nenhum relatório gerado</h3>
              <p className="text-muted-foreground">Execute as etapas do pipeline para gerar relatórios.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
