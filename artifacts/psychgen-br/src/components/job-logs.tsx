import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type LogEvent = {
  type: "progress" | "log";
  ts: string;
  message: string;
  progress?: number | null;
  level?: "info" | "warn" | "error" | null;
};

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

export function JobLogs({ jobId, isLive }: { jobId: number; isLive: boolean }) {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function snapshot() {
      try {
        const r = await fetch(`${API_BASE}/pipeline/jobs/${jobId}/logs`);
        if (!r.ok) return;
        const data = (await r.json()) as LogEvent[];
        if (!cancelled) setEvents(data);
      } catch {
        /* ignore */
      }
    }
    snapshot();
    if (!isLive) return () => { cancelled = true; };

    const es = new EventSource(`${API_BASE}/pipeline/jobs/${jobId}/logs`);
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data) as LogEvent;
        setEvents((prev) => [...prev, e].slice(-500));
      } catch {
        /* ignore malformed */
      }
    };
    es.onerror = () => es.close();
    return () => {
      cancelled = true;
      es.close();
    };
  }, [jobId, isLive]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events]);

  const colorFor = (lvl?: string | null) => {
    if (lvl === "error") return "text-red-500";
    if (lvl === "warn") return "text-amber-500";
    return "text-foreground";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Logs do R
          {isLive && <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">ao vivo</Badge>}
        </CardTitle>
        <CardDescription>Eventos estruturados emitidos pelos scripts R durante a execução.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          ref={scrollerRef}
          className="bg-zinc-950 text-zinc-100 rounded-md font-mono text-xs p-3 max-h-[420px] overflow-auto"
          data-testid="job-logs"
        >
          {events.length === 0 ? (
            <span className="text-zinc-500">Aguardando eventos...</span>
          ) : (
            events.map((e, i) => (
              <div key={i} className="leading-relaxed">
                <span className="text-zinc-500">{e.ts.slice(11, 19)}</span>{" "}
                {e.type === "progress" ? (
                  <span className="text-blue-400">
                    [progress {Math.round((e.progress ?? 0) * 100)}%] {e.message}
                  </span>
                ) : (
                  <span className={colorFor(e.level)}>
                    [{e.level ?? "info"}] {e.message}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
