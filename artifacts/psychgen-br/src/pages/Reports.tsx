import { useListReports } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/formatters";
import { FileText, ChevronRight, BarChart2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Reports() {
  const { data: reports, isLoading } = useListReports();

  const getReportKindBadge = (kind: string) => {
    switch (kind) {
      case 'aigenie': return <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">AIGENIE</Badge>;
      case 'difficulty': return <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Dificuldade</Badge>;
      case 'irt': return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">IRT</Badge>;
      case 'validation': return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Validação</Badge>;
      default: return <Badge variant="outline">{kind}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">Resultados analíticos e relatórios de métricas do laboratório.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="flex flex-col h-[200px]">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="flex-1 pb-4 flex flex-col justify-end">
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))
        ) : reports?.length === 0 ? (
          <div className="col-span-full py-12 text-center border rounded-lg bg-card/50">
            <BarChart2 className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">Nenhum relatório encontrado</h3>
            <p className="text-muted-foreground mb-4">Execute os processos de calibração para gerar relatórios.</p>
            <Link href="/projects">
              <Button variant="outline">Ver Projetos</Button>
            </Link>
          </div>
        ) : (
          reports?.map((report) => (
            <Card key={report.id} className="flex flex-col hover:border-primary/50 transition-colors group">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs font-mono text-muted-foreground flex flex-col gap-1">
                    <span>ID-{report.id}</span>
                    <Link href={`/projects/${report.projectId}`} className="hover:underline">Proj-{report.projectId}</Link>
                  </div>
                  {getReportKindBadge(report.kind)}
                </div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Relatório {report.kind}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pt-2 pb-2">
                <p className="text-sm text-muted-foreground line-clamp-3">{report.summary}</p>
              </CardContent>
              <CardFooter className="pt-2 border-t mt-auto flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {formatDate(report.createdAt, "dd/MM/yy HH:mm")}
                </span>
                <Link href={`/reports/${report.id}`}>
                  <Button variant="ghost" size="sm" className="gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Visualizar <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
