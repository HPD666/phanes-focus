import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Loader2, Layers, History, Sparkles } from "lucide-react";
import { formatLatLng, ageLabel, hash01 } from "@/lib/geo";
import { LAYERS, LAYER_MAP, type LayerId } from "@/lib/layers";
import { cn } from "@/lib/utils";

export default function Gallery() {
  const navigate = useNavigate();
  const [layerFilter, setLayerFilter] = useState<LayerId | "all">("all");
  const captures = useQuery(api.captures.listForUser);
  const deleteCapture = useMutation(api.captures.remove);

  useEffect(() => {
    if (captures === undefined) return;
  }, [captures]);

  const filtered =
    layerFilter === "all"
      ? captures ?? []
      : (captures ?? []).filter((c) => {                    const m = c.metrics;
                    if (layerFilter === "history") return true;
                    if (layerFilter === "inscriptions") return c.ocr.length > 0;
                    if (layerFilter === "biosphere") return (m?.vegetationIndex ?? 0) > 0.25;
                    if (layerFilter === "energy") return (m?.edgeDensity ?? 0) > 0.3;
                    if (layerFilter === "weather") return true;
                    if (layerFilter === "flow") return (m?.motion ?? 0) > 0.02;
                    if (layerFilter === "structure") return (m?.edgeDensity ?? 0) > 0.2;
                    if (layerFilter === "signals") return true;
                    if (layerFilter === "anomalies") return (m?.anomalyScore ?? 0) > 0.5;
                    if (layerFilter === "core") return true;
                    if (layerFilter === "omni") return true;
                    return true;
        });

  return (
    <div className="relative flex flex-col min-h-screen bg-[#02040a] text-white">
      {/* backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(8,18,34,0.9), #02040a), radial-gradient(ellipse at 50% 0%, rgba(82,224,255,0.10), transparent 55%)",
        }}
      />
      <div className="hud-scanlines pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-4 top-14 size-10 border-l-2 border-t-2 border-[#52e0ff]/40" />
      <div className="pointer-events-none absolute right-4 top-14 size-10 border-r-2 border-t-2 border-[#52e0ff]/40" />
      <div className="pointer-events-none absolute bottom-20 left-4 size-10 border-b-2 border-l-2 border-[#52e0ff]/40" />
      <div className="pointer-events-none absolute bottom-20 right-4 size-10 border-b-2 border-r-2 border-[#52e0ff]/40" />

      {/* top bar */}
      <header className="relative z-10 flex h-11 items-center justify-between border-b border-white/10 bg-[#02060d]/70 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm leading-none text-[#52e0ff]">◈</span>
          <span className="font-display text-sm font-semibold tracking-[0.25em] text-white">
            PHANES
          </span>
          <span className="hud-label hidden sm:inline">Archive Terminal</span>
          <span className="hud-label">{captures?.length ?? 0} frames</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/focus")}
            className="hud-label cursor-pointer rounded-sm border border-white/10 px-2 py-1 transition-colors hover:border-white/30 flex items-center gap-1"
          >
            <Layers className="size-3" style={{ color: "#52e0ff" }} />
            Back to Focus
          </button>
        </div>
      </header>

      {/* gallery grid */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-sm border border-[#52e0ff]/40 bg-[#52e0ff]/5">
            <History className="size-5 text-[#52e0ff]" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-wide text-white">
              Capture History
            </h1>
            <p className="hud-label mt-0.5">
              Every archived frame. Filter by layer.
            </p>
          </div>
        </div>

        {/* layer filter strip */}
        <div className="mb-8 flex flex-wrap gap-2">
          {(["all", ...LAYERS.filter((l) => !l.super).map((l) => l.id)] as const).map(
            (id) => {
              const isActive = layerFilter === id;
              const layer = id === "all" ? null : LAYER_MAP[id];
              const color = id === "all" ? "#52e0ff" : layer?.color ?? "#ffffff";
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLayerFilter(id)}
                  className={`hud-panel flex items-center gap-1.5 rounded-sm px-3 py-1.5 transition-colors hover:border-white/30 ${
                    isActive ? "border-white/30" : "border-white/10"
                  }`}
                  title={layer ? layer.tagline : "Show every layer"}
                >
                  {layer ? (
                    <layer.icon className="size-3.5" style={{ color }} />
                  ) : (
                    <Sparkles className="size-3.5" style={{ color }} />
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: isActive ? "#fff" : "rgba(160,210,240,0.65)" }}>
                    {id === "all" ? "ALL" : id.toUpperCase()}
                  </span>
                </button>
              );
            },
          )}
        </div>

        {captures === undefined ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-6 animate-spin text-[#52e0ff]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-sm border border-white/10 bg-white/[0.02] py-16 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-sm border border-[#52e0ff]/30 bg-[#52e0ff]/5 mb-4">
              <History className="size-6 text-[#52e0ff]" />
            </div>
            <p className="hud-label text-[#cfeaff]/80 mb-1">No captures in this view</p>
            <p className="text-sm text-[#8fb8d8]/70">
              {layerFilter === "all"
                ? "Archive frames from the Focus to fill this terminal."
                : `Switch the layer filter to ALL to see every archived frame.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((c) => {
              const m = c.metrics;
              const lat = c.lat;
              const lng = c.lng;

              return (
                <div
                  key={c._id}
                  className="hud-panel group relative rounded-sm overflow-hidden p-3 cursor-pointer transition-all hover:border-white/30 hover:shadow-[0_0_30px_rgba(82,224,255,0.12)]"
                >
                  {/* stamp */}
                  <div
                    className="absolute left-0 top-0 h-5 w-5 bg-black/40 font-mono text-[8px] uppercase tracking-[0.1em] text-white/60"
                    style={{ background: `linear-gradient(135deg, ${c.thumb.slice(0, 7) === "data:" ? "transparent" : "#000"}, transparent 60%)` }}
                  >
                    {ageLabel(c.createdAt)}
                  </div>
                  {/* thumbnail */}
                  <img
                    src={c.thumb}
                    alt={`Capture ${new Date(c.createdAt).toLocaleString()}`}
                    className="aspect-[4/3] w-full rounded-sm object-cover grayscale-[35%] transition-opacity group-hover:grayscale-0"
                    style={{ filter: "sepia(0.25) hue-rotate(-18deg)" }}
                  />
                  {/* meta */}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-white/80">
                        {Math.round((m.brightness ?? 0) * 100)}% ·{" "}
                        {Math.round((m.edgeDensity ?? 0) * 100)}% edges
                      </span>
                      {c.ocr.length > 0 && (
                        <span className="hud-label text-[#c3a1ff]">
                          {c.ocr.length} T↑
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[10px] text-[#7fb2d8]/70">
                        {lat !== null && lng !== null
                          ? formatLatLng(lat, lng)
                          : "POS —"}
                      </span>
                      <span className="hud-label text-white/40">
                        HDG{" "}
                        {String(Math.round((c.heading % 360 + 360) % 360)).padStart(3, "0")}°
                      </span>
                    </div>
                    {c.ocr.length > 0 && (
                      <div className="mt-1 flex gap-1 overflow-hidden">
                        {c.ocr.slice(0, 2).map((o, i) => (
                          <span
                            key={i}
                            className="truncate rounded-sm border border-[#c3a1ff]/30 bg-[#c3a1ff]/5 px-1.5 py-0.5 font-mono text-[9px] text-[#c3a1ff]/90"
                          >
                            {o.text}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* delete */}
                  <button
                    type="button"
                    disabled={captures === undefined}
                    className="pointer-events-auto absolute right-2 top-2 rounded-sm border border-white/10 bg-black/50 px-2 py-1 text-[9px] uppercase tracking-[0.15em] text-white/50 opacity-0 transition-all group-hover:opacity-100 hover:border-red-400/40 hover:text-red-300 disabled:opacity-30"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (captures === undefined) return;
                      deleteCapture({ id: c._id });
                      toast.success("Capture purged from archive");
                    }}
                    title="Remove this capture"
                  >
                    <Trash2 className="size-3" />
                    DEL
                  </button>
                  {/* accent corner */}
                  <span className="absolute left-0 top-0 h-1 w-1 border-l-2 border-t-2" style={{ borderColor: "#52e0ff" }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="relative z-10 border-t border-white/10 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="hud-label text-white/40">PHANES · Archive Terminal · on-device analysis</div>
          <div className="flex items-center gap-2">
            <span className="hud-label text-white/30">10 layers</span>
            {["#52e0ff","#ffb454","#c3a1ff","#ffcf3f","#6fb5ff","#ff8fa3","#7dff9b","#9fb6ff","#2ff3e0","#ff5d6c"].map((c)=>(
              <span key={c} className="size-1.5 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 6px ${c}` }} />
            ))}
            <span className="hud-label text-[#e8f6ff]/60">+ OMNI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

