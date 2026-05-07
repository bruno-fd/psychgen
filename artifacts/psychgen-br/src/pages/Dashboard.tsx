import { useGetDashboardSummary, useGetRecentActivity, useHealthCheck } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatBrlNumber } from "@/lib/formatters";
import {
  Activity, Database, Server, CheckCircle2, XCircle, AlertCircle,
  FileText, ActivitySquare, FolderKanban, Boxes,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`w-2 h-2 rounded-full ${ok ? "bg-green-500" : "bg-destructive"}`}
    />
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: recentActivity, isLoading: isLoadingActivity } = useGetRecentActivity({ limit: 10 });
  // Pass deep=1 so the dashboard can render the full R package list / version.
  const { data: health } = useHealthCheck({ query: { deep: "1" } } as never);

  const apiOk = health?.status === "ok";
  const dbOk = health?.db === "ok";
  const rEngine = health?.rEngine;
  const rOk = !!rEngine && !rEngine.error && (rEngine.packages?.length ?? 0) > 0
    && (rEngine.packages ?? []).every((p) => p.available);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Painel de Controle</h1>
        <p className="text-muted-foreground">Métricas gerais do laboratório de geração e calibração psicométrica.</p>
      </div>

      {/* Health Status Bar */}
      {health && (
        <div className="space-y-3 p-3 bg-card border rounded-lg text-sm">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs">API:</span>
              <span className="flex items-center gap-1"><StatusDot ok={apiOk} /> {health.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs">DB:</span>
              <span className="flex items-center gap-1"><StatusDot ok={dbOk} /> {health.db}</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs">R engine:</span>
              <span className="flex items-center gap-1">
                <StatusDot ok={rOk} />
                {rEngine?.skipped
                  ? "não verificado"
                  : rEngine?.error
                    ? `erro: ${rEngine.error.slice(0, 60)}`
                    : `${rEngine?.rVersion ?? "?"} (${rEngine?.mode})`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">OpenAI:</span>
              <span className="flex items-center gap-1">
                <StatusDot ok={health.openai === "configured"} /> {health.openai}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">Anthropic:</span>
              <span className="flex items-center gap-1">
                <StatusDot ok={health.anthropic === "configured"} /> {health.anthropic}
              </span>
            </div>
          </div>

          {/* Detailed R package list (only on deep check) */}
          {rEngine && !rEngine.skipped && (rEngine.packages?.length ?? 0) > 0 && (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <Boxes className="h-3 w-3" />
                <span>Pacotes R disponíveis em <span className="font-mono">~/.R/library-4.4</span></span>
                {rEngine.aigenieAvailable !== null && (
                  <Badge variant={rEngine.aigenieAvailable ? "default" : "outline"} className="text-[10px]">
                    AIGENIE: {rEngine.aigenieAvailable ? "instalado" : "ausente (fallback igraph)"}
                  </Badge>
                )}
                {rEngine.udpipeModelCached !== null && (
                  <Badge variant={rEngine.udpipeModelCached ? "default" : "outline"} className="text-[10px]">
                    udpipe PT-BR: {rEngine.udpipeModelCached ? "cache OK" : "ausente"}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5" data-testid="r-package-list">
                {rEngine.packages.map((p) => (
                  <Badge
                    key={p.name}
                    variant={p.available ? "secondary" : "destructive"}
                    className="text-[10px] font-mono"
                  >
                    {p.available ? <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> : <AlertCircle className="h-2.5 w-2.5 mr-1" />}
                    {p.name}
                    {p.available && p.version ? ` ${p.version}` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projetos Ativos</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingSummary ? <Skeleton className="h-8 w-16" /> : formatBrlNumber(summary?.totalProjects || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens Gerados</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingSummary ? <Skeleton className="h-8 w-16" /> : formatBrlNumber(summary?.totalItems || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens Aprovados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingSummary ? <Skeleton className="h-8 w-16" /> : formatBrlNumber(summary?.approvedItems || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.totalItems ? formatBrlNumber((summary.approvedItems / summary.totalItems) * 100, 1) : 0}% taxa de aprovação
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processos em Execução</CardTitle>
            <ActivitySquare className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingSummary ? <Skeleton className="h-8 w-16" /> : formatBrlNumber(summary?.jobsRunning || 0)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Construct Distribution */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Distribuição por Construto</CardTitle>
            <CardDescription>Volume de itens gerados por domínio psicológico</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoadingSummary ? (
              <Skeleton className="w-full h-full" />
            ) : summary?.itemsByConstruct && summary.itemsByConstruct.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.itemsByConstruct} layout="vertical" margin={{ left: 50 }}>
                  <XAxis type="number" />
                  <YAxis dataKey="construct" type="category" width={100} tick={{ fontSize: 12 }} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--card-foreground)' }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados suficientes</div>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>Log de operações de pipeline e moderação</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingActivity ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity?.map((activity) => (
                  <div key={activity.id} className="flex gap-4 items-start pb-4 border-b last:border-0 last:pb-0">
                    <div className="mt-1">
                      {activity.type === 'job_completed' || activity.type === 'item_approved' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : activity.type === 'job_failed' || activity.type === 'item_rejected' ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : activity.type === 'job_started' ? (
                        <ActivitySquare className="h-4 w-4 text-amber-500" />
                      ) : (
                        <FolderKanban className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.projectName} {activity.stage ? ` • Estágio: ${activity.stage}` : ''}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(activity.createdAt, "dd/MM HH:mm")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
