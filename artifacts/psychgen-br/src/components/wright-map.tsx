import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type WrightMapData = {
  items?: { itemId: number; difficulty: number }[];
  thetaHistogram?: { bin: number; count: number }[];
};

export function WrightMap({ data }: { data: WrightMapData }) {
  const items = data.items ?? [];
  const theta = data.thetaHistogram ?? [];

  const { domain, itemBins, maxThetaCount } = useMemo(() => {
    const allVals = [
      ...items.map((i) => i.difficulty),
      ...theta.map((t) => t.bin),
    ];
    if (allVals.length === 0) return { domain: [-3, 3] as [number, number], itemBins: new Map<number, number>(), maxThetaCount: 1 };
    const lo = Math.min(...allVals, -3);
    const hi = Math.max(...allVals, 3);
    const pad = (hi - lo) * 0.05;
    const dom: [number, number] = [Math.floor(lo - pad), Math.ceil(hi + pad)];
    const bins = new Map<number, number>();
    for (const it of items) {
      const k = Math.round(it.difficulty * 4) / 4;
      bins.set(k, (bins.get(k) ?? 0) + 1);
    }
    return {
      domain: dom,
      itemBins: bins,
      maxThetaCount: Math.max(1, ...theta.map((t) => t.count)),
    };
  }, [items, theta]);

  if (items.length === 0 && theta.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Sem dados para o Wright Map.
      </div>
    );
  }

  const range = domain[1] - domain[0];
  const yFor = (v: number) => ((domain[1] - v) / range) * 100;
  const ticks: number[] = [];
  for (let v = Math.ceil(domain[0]); v <= domain[1]; v++) ticks.push(v);

  const maxItemBin = Math.max(1, ...Array.from(itemBins.values()));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wright Map</CardTitle>
        <CardDescription>
          Distribuição da habilidade dos respondentes (theta, à esquerda) versus dificuldade dos itens (b, à direita) na mesma escala logit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[1fr_60px_1fr] gap-2 h-[480px]" data-testid="wright-map">
          {/* Persons (theta histogram) — bars grow leftward */}
          <div className="relative border-r bg-muted/20">
            <div className="absolute top-1 left-2 text-xs font-semibold text-muted-foreground">Pessoas (theta)</div>
            {theta.map((t, idx) => {
              const w = (t.count / maxThetaCount) * 95;
              return (
                <div
                  key={idx}
                  className="absolute right-0 h-2 bg-blue-500/70 rounded-l"
                  style={{
                    top: `${yFor(t.bin)}%`,
                    width: `${w}%`,
                  }}
                  title={`theta=${t.bin.toFixed(2)} | n=${t.count}`}
                />
              );
            })}
          </div>

          {/* Logit axis */}
          <div className="relative">
            {ticks.map((v) => (
              <div
                key={v}
                className="absolute left-0 right-0 flex items-center justify-center"
                style={{ top: `${yFor(v)}%`, transform: "translateY(-50%)" }}
              >
                <div className="absolute left-0 right-0 border-t border-dashed border-muted-foreground/30" />
                <span className="relative bg-background px-1 text-xs font-mono text-muted-foreground">
                  {v.toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          {/* Items (difficulty) — dots grow rightward, grouped by bin */}
          <div className="relative border-l bg-muted/20">
            <div className="absolute top-1 right-2 text-xs font-semibold text-muted-foreground">Itens (dificuldade)</div>
            {Array.from(itemBins.entries()).map(([bin, count]) => (
              <div
                key={bin}
                className="absolute left-0 flex items-center gap-0.5"
                style={{ top: `${yFor(bin)}%`, transform: "translateY(-50%)" }}
                title={`b≈${bin.toFixed(2)} | ${count} itens`}
              >
                {Array.from({ length: Math.min(count, 12) }).map((_, i) => (
                  <span
                    key={i}
                    className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                    style={{ opacity: 0.5 + (0.5 * (i + 1)) / Math.max(1, maxItemBin) }}
                  />
                ))}
                {count > 12 && (
                  <span className="text-xs text-muted-foreground ml-1">+{count - 12}</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div>N respondentes nos bins: <strong>{theta.reduce((s, t) => s + t.count, 0)}</strong></div>
          <div className="text-right">N itens calibrados: <strong>{items.length}</strong></div>
        </div>
      </CardContent>
    </Card>
  );
}
