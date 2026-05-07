import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code2, Download, Copy, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";

interface RScriptPreviewProps {
  projectId: number;
  stage: "aigenie" | "difficulty" | "irt" | "sample_design";
  /** Watched form values — `params` shape matching the run body. */
  params: unknown;
  /** Filename for the .R download (without extension). */
  filenamePrefix?: string;
}

export function RScriptPreview({
  projectId,
  stage,
  params,
  filenamePrefix,
}: RScriptPreviewProps) {
  const debouncedParams = useDebounce(params, 350);
  const [script, setScript] = useState<string>("# Aguardando parâmetros…\n");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (debouncedParams == null) return;
    const myReq = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    fetch(`/api/projects/${projectId}/runs/${stage}/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ params: debouncedParams }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const txt = await r.text();
          throw new Error(`HTTP ${r.status}: ${txt.slice(0, 200)}`);
        }
        return r.json() as Promise<{ script: string }>;
      })
      .then((data) => {
        if (myReq !== reqIdRef.current) return;
        setScript(data.script);
      })
      .catch((e) => {
        if (myReq !== reqIdRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (myReq === reqIdRef.current) setLoading(false);
      });
  }, [debouncedParams, projectId, stage]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Falha ao copiar",
        description: "Não foi possível acessar a área de transferência.",
        variant: "destructive",
      });
    }
  };

  const onDownload = () => {
    const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenamePrefix ?? `psychgen_${stage}`}_${projectId}.R`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            Sintaxe R
            {loading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={onCopy}
              className="h-7 px-2"
              data-testid="button-copy-r"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDownload}
              className="h-7 px-2 gap-1"
              data-testid="button-download-r"
            >
              <Download className="h-3 w-3" />
              <span className="text-xs">.R</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div className="text-xs text-destructive p-3 border-t">
            {error}
          </div>
        ) : (
          <pre
            className="text-[11px] leading-relaxed font-mono bg-muted/40 border-t p-3 overflow-x-auto max-h-[60vh] overflow-y-auto"
            data-testid="r-script-preview"
          >
            <code>{script}</code>
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
