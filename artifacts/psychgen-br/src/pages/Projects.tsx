import { useListProjects } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatPercent } from "@/lib/formatters";
import { Plus, FolderOpen, ChevronRight, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Projects() {
  const { data: projects, isLoading } = useListProjects();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="outline">Rascunho</Badge>;
      case 'generating': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200">Gerando</Badge>;
      case 'calibrating': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200">Calibrando</Badge>;
      case 'ready': return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200">Pronto</Badge>;
      case 'archived': return <Badge variant="secondary">Arquivado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projetos</h1>
          <p className="text-muted-foreground">Gerencie seus instrumentos e escalas psicométricas.</p>
        </div>
        <Link href="/projects/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Projeto
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="flex flex-col h-[220px]">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="flex-1 pb-4 flex flex-col justify-end">
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))
        ) : projects?.length === 0 ? (
          <div className="col-span-full py-12 text-center border rounded-lg bg-card/50">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhum projeto encontrado</h3>
            <p className="text-muted-foreground mb-4">Crie seu primeiro projeto para começar a gerar itens.</p>
            <Link href="/projects/new">
              <Button variant="outline">Criar Projeto</Button>
            </Link>
          </div>
        ) : (
          projects?.map((project) => (
            <Card key={project.id} className="flex flex-col hover:border-primary/50 transition-colors group">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs font-mono text-muted-foreground">ID-{project.id}</div>
                  {getStatusBadge(project.status)}
                </div>
                <CardTitle className="text-xl line-clamp-1" title={project.name}>{project.name}</CardTitle>
                <CardDescription className="line-clamp-1">{project.construct} • {project.targetAudience}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end pt-4 pb-4">
                <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                  <div className="flex flex-col bg-muted/50 p-2 rounded">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Itens</span>
                    <span className="font-semibold">{project.itemCount}</span>
                  </div>
                  <div className="flex flex-col bg-muted/50 p-2 rounded">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Aprovados</span>
                    <span className="font-semibold">{project.approvedCount} ({formatPercent(project.itemCount ? project.approvedCount / project.itemCount : 0)})</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    {formatDate(project.updatedAt, "dd/MM/yy")}
                  </span>
                  <Link href={`/projects/${project.id}`}>
                    <Button variant="ghost" size="sm" className="gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Abrir <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
