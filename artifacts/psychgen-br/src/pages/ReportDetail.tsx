import { useParams, Link } from "wouter";
import { useGetReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Calendar, BarChart2 } from "lucide-react";
import { formatDate } from "@/lib/formatters";

export default function ReportDetail() {
  const params = useParams();
  const id = Number(params.id);

  const { data: report, isLoading } = useGetReport(id);

  const getReportKindBadge = (kind: string) => {
    switch (kind) {
      case 'aigenie': return <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">AIGENIE</Badge>;
      case 'difficulty': return <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Dificuldade</Badge>;
      case 'irt': return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">IRT</Badge>;
      case 'validation': return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Validação</Badge>;
      default: return <Badge variant="outline">{kind}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!report) {
    return <div className="text-center py-12 text-muted-foreground">Relatório não encontrado.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/reports">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            Relatório #{report.id}
            {getReportKindBadge(report.kind)}
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <Calendar className="h-4 w-4" />
            {formatDate(report.createdAt, "dd/MM/yyyy HH:mm")}
            <span className="mx-2">•</span>
            Projeto: <Link href={`/projects/${report.projectId}`} className="hover:underline">ID-{report.projectId}</Link>
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Resumo Executivo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed">{report.summary}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" /> Métricas Detalhadas
            </CardTitle>
            <CardDescription>
              Dados brutos gerados durante a execução do processo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.metricsJson ? (
              <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-[600px] border">
                {JSON.stringify(report.metricsJson, null, 2)}
              </pre>
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-muted/50 rounded-md border border-dashed">
                Nenhuma métrica estruturada disponível para este relatório.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
