import { useParams, Link } from "wouter";
import { useGetPipelineJob, useCancelPipelineJob, getGetPipelineJobQueryKey, getListPipelineJobsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Play, AlertTriangle, CheckCircle2, Clock, XCircle, Info, Ban } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function JobDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: job, isLoading } = useGetPipelineJob(id, {
    query: {
      queryKey: getGetPipelineJobQueryKey(id),
      refetchInterval: (q) => q.state.data?.status === 'running' ? 3000 : false,
    },
  });

  const cancelJob = useCancelPipelineJob();

  const handleCancel = () => {
    cancelJob.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPipelineJobQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListPipelineJobsQueryKey() });
        toast({ title: "Processo cancelado", description: "O processo foi interrompido." });
      }
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued': return <Clock className="h-4 w-4" />;
      case 'running': return <Play className="h-4 w-4 text-blue-500" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'cancelled': return <Ban className="h-4 w-4 text-muted-foreground" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'queued': return <Badge variant="outline">Na Fila</Badge>;
      case 'running': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Executando</Badge>;
      case 'completed': return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Concluído</Badge>;
      case 'failed': return <Badge variant="destructive">Falhou</Badge>;
      case 'cancelled': return <Badge variant="secondary">Cancelado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!job) {
    return <div className="text-center py-12 text-muted-foreground">Processo não encontrado.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/jobs">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Processo #{job.id}
            {getStatusBadge(job.status)}
          </h1>
          <p className="text-muted-foreground">
            Projeto: <Link href={`/projects/${job.projectId}`} className="hover:underline">ID-{job.projectId}</Link> • Estágio: {job.stage}
          </p>
        </div>
        <div className="ml-auto">
          {job.status === 'running' && (
            <Button variant="destructive" onClick={handleCancel} disabled={cancelJob.isPending}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {job.status === 'running' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Progresso</span>
              <span className="text-sm font-medium">{Math.round(job.progress * 100)}%</span>
            </div>
            <Progress value={job.progress * 100} className="h-2" />
            {job.message && (
              <p className="text-xs text-muted-foreground mt-2">{job.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {job.status === 'failed' && job.error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Erro na Execução
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-destructive/10 p-4 rounded-md text-sm text-destructive overflow-auto whitespace-pre-wrap">
              {job.error}
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Parâmetros</CardTitle>
            <CardDescription>Configuração utilizada nesta execução</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-[400px]">
              {JSON.stringify(job.paramsJson, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
            <CardDescription>Saída gerada pelo processo</CardDescription>
          </CardHeader>
          <CardContent>
            {job.resultJson ? (
              <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-[400px]">
                {JSON.stringify(job.resultJson, null, 2)}
              </pre>
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-muted/50 rounded-md border border-dashed">
                Sem resultados disponíveis
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
