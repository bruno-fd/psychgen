import { useGetDashboardSummary, useGetRecentActivity, useHealthCheck } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatBrlNumber } from "@/lib/formatters";
import { Activity, Database, Server, CheckCircle2, XCircle, AlertCircle, FileText, ActivitySquare, FolderKanban } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: recentActivity, isLoading: isLoadingActivity } = useGetRecentActivity({ limit: 10 });
  const { data: health } = useHealthCheck();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Painel de Controle</h1>
        <p className="text-muted-foreground">Métricas gerais do laboratório de geração e calibração psicométrica.</p>
      </div>

      {/* Health Status Bar */}
      {health && (
        <div className="flex gap-4 p-3 bg-card border rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-xs">API:</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> {health.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-xs">DB:</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> {health.db}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-xs">R (mirt/EGA):</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> {health.rRuntime}</span>
          </div>
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
