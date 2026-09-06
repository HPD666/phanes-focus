import { useEffect } from "react";
import { LAYERS, type LayerId } from "@/lib/layers";
import { cn } from "@/lib/utils";

interface LayerBarProps {
  active: LayerId;
  onSelect: (id: LayerId) => void;
}

export function LayerBar({ active, onSelect }: LayerBarProps) {
  // hotkeys 1..9, 0, o
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const layer = LAYERS.find((l) => l.hotkey === e.key.toLowerCase());
      if (layer) onSelect(layer.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelect]);

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-3 z-30 flex justify-center px-2">
      <div className="hud-panel flex max-w-full items-center gap-1 overflow-x-auto rounded-sm px-2 py-1.5 hud-scrollbar">
        {LAYERS.map((layer, i) => {
          const isActive = layer.id === active;
          const Icon = layer.icon;
          return (
            <div key={layer.id} className="flex items-center">
              {layer.super && <div className="mx-1.5 h-8 w-px bg-white/10" />}
              {i === 0 && <div className="mr-1" />}
              <button
                type="button"
                onClick={() => onSelect(layer.id)}
                title={`${layer.name} — ${layer.tagline}`}
                className={cn(
                  "group relative flex min-w-[72px] flex-col items-center gap-1 rounded-sm px-2.5 py-1.5 transition-colors",
                  isActive ? "bg-white/5" : "hover:bg-white/5",
                )}
              >
                {isActive && (
                  <>
                    <span
                      className="absolute left-0 top-0 h-1.5 w-1.5 border-l-2 border-t-2"
                      style={{ borderColor: layer.color }}
                    />
                    <span
                      className="absolute right-0 top-0 h-1.5 w-1.5 border-r-2 border-t-2"
                      style={{ borderColor: layer.color }}
                    />
                    <span
                      className="absolute bottom-0 left-0 h-1.5 w-1.5 border-b-2 border-l-2"
                      style={{ borderColor: layer.color }}
                    />
                    <span
                      className="absolute bottom-0 right-0 h-1.5 w-1.5 border-b-2 border-r-2"
                      style={{ borderColor: layer.color }}
                    />
                  </>
                )}
                <Icon
                  className="size-4 transition-all group-hover:scale-110"
                  style={{
                    color: isActive ? layer.color : "rgba(160,210,240,0.55)",
                    filter: isActive ? `drop-shadow(0 0 6px ${layer.color})` : "none",
                  }}
                />
                <span
                  className={cn(
                    "font-mono text-[9px] uppercase tracking-[0.12em]",
                    isActive ? "text-white" : "text-[#7fb2d8]/70",
                  )}
                >
                  {layer.name}
                </span>
                <span
                  className="absolute right-1 top-1 font-mono text-[7px] text-white/25"
                >
                  {layer.hotkey}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}