import { useState } from "react";
import { Link } from "wouter";
import { useListPipelineJobs, getListPipelineJobsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, CheckCircle2, AlertTriangle, Clock, Ban, ChevronRight, Activity } from "lucide-react";
import { formatDate } from "@/lib/formatters";

export default function Jobs() {
  const [stageFilter, setStageFilter] = useState<string>("all");

  const queryParams = stageFilter !== "all" ? { stage: stageFilter as any } : {};

  const { data: jobs, isLoading } = useListPipelineJobs(queryParams, {
    query: {
      queryKey: getListPipelineJobsQueryKey(queryParams),
      refetchInterval: (q) => {
        const hasRunning = q.state.data?.some((j: any) => j.status === 'running');
        return hasRunning ? 3000 : false;
      },
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'queued': return <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3"/> Na Fila</Badge>;
      case 'running': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 flex items-center gap-1"><Play className="h-3 w-3"/> Executando</Badge>;
      case 'completed': return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 flex items-center gap-1"><CheckCircle2 className="h-3 w-3"/> Concluído</Badge>;
      case 'failed': return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3"/> Falhou</Badge>;
      case 'cancelled': return <Badge variant="secondary" className="flex items-center gap-1"><Ban className="h-3 w-3"/> Cancelado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Processamento</h1>
          <p className="text-muted-foreground">Acompanhe a execução dos jobs do pipeline.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por estágio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estágios</SelectItem>
              <SelectItem value="aigenie">AIGENIE</SelectItem>
              <SelectItem value="difficulty">Dificuldade</SelectItem>
              <SelectItem value="irt">Calibração IRT</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">ID</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Estágio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[200px]">Progresso</TableHead>
                <TableHead>Data</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-2 w-full mt-2" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : jobs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                    Nenhum processo encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                jobs?.map((job) => (
                  <TableRow key={job.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-mono text-xs text-muted-foreground">#{job.id}</TableCell>
                    <TableCell>
                      <Link href={`/projects/${job.projectId}`} className="hover:underline font-medium">
                        ID-{job.projectId}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{job.stage}</TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell>
                      {job.status === 'running' ? (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{Math.round(job.progress * 100)}%</span>
                          </div>
                          <Progress value={job.progress * 100} className="h-1.5" />
                        </div>
                      ) : job.status === 'completed' ? (
                        <span className="text-xs text-muted-foreground">100%</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(job.createdAt, "dd/MM HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/jobs/${job.id}`}>
                        <span className="inline-flex items-center text-xs text-primary hover:underline cursor-pointer">
                          Detalhes <ChevronRight className="h-3 w-3 ml-1" />
                        </span>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
