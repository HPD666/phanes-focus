import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CloudSun,
  Cpu,
  History,
  Layers,
  Leaf,
  Radio,
  Scan,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { SynthScene } from "@/lib/synth";
import { ACTIVE_LAYERS } from "@/lib/layers";
import { useAuth } from "@/hooks/use-auth";

const LAYER_ICONS: Record<
  (typeof ACTIVE_LAYERS)[number]["id"],
  typeof Scan
> = {
  core: Scan,
  history: History,
  inscriptions: ScrollText,
  energy: Zap,
  weather: CloudSun,
  flow: Activity,
  biosphere: Leaf,
  structure: Building2,
  signals: Radio,
  anomalies: AlertTriangle,
  omni: Layers,
};

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new SynthScene(canvas, { seed: 4242, interactive: true });
    scene.setHour(new Date().getHours() + new Date().getMinutes() / 60);
    scene.start();
    const ro = new ResizeObserver(() => scene.resize());
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      scene.stop();
    };
  }, []);

  const enterFocus = () => navigate(isAuthenticated ? "/focus" : "/auth?returnTo=%2Ffocus");

  return (
    <div className="min-h-screen bg-[#02040a] text-white">
      {/* ============ HERO ============ */}
      <section className="relative flex h-[100svh] flex-col overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 size-full" />

        {/* HUD chrome over backdrop */}
        <div className="pointer-events-none absolute inset-0">
          <div className="hud-scanlines absolute inset-0" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)",
            }}
          />
          <div className="absolute left-6 top-6 size-12 border-l-2 border-t-2 border-[#52e0ff]/60" />
          <div className="absolute right-6 top-6 size-12 border-r-2 border-t-2 border-[#52e0ff]/60" />
          <div className="absolute bottom-24 left-6 size-12 border-b-2 border-l-2 border-[#52e0ff]/60" />
          <div className="absolute bottom-24 right-6 size-12 border-b-2 border-r-2 border-[#52e0ff]/60" />
        </div>

        {/* top bar */}
        <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/30 px-6 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-lg leading-none text-[#52e0ff]">◈</span>
            <span className="font-display text-base font-semibold tracking-[0.3em]">
              PHANES
            </span>
            <span className="hud-label hidden sm:inline">Focus Intelligence</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hud-label hidden md:inline">
              {ACTIVE_LAYERS.length} layers + OMNI super layer
            </span>
            <span className="hud-label flex items-center gap-1.5 text-[#7dff9b]">
              <span className="size-1.5 animate-pulse rounded-full bg-[#7dff9b]" />
              FREE FOREVER
            </span>
          </div>
        </header>

        {/* hero content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="hud-label mb-4 flex items-center gap-2 rounded-sm border border-white/15 bg-black/40 px-3 py-1.5"
          >
            <Sparkles className="size-3 text-[#52e0ff]" />
            Point your lens at the world — Phanes reads it back
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
          >
            SEE EVERYTHING.
            <br />
            <span className="text-[#52e0ff]" style={{ textShadow: "0 0 40px rgba(82,224,255,0.5)" }}>
              IN LAYERS.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-6 max-w-2xl text-base leading-relaxed text-[#a8cfe8]/80 sm:text-lg"
          >
            A Focus-style augmented reality overlay. Ten analysis layers —
            history, hidden text, energy, weather, flow, biosphere, structure,
            signals, anomalies — and an OMNI super layer that renders them all
            at once. Every reading is computed live from real pixels and real
            telemetry. No cloud bill. No subscription. Ever.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.32 }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
          >
            <button
              type="button"
              onClick={enterFocus}
              className="group relative flex cursor-pointer items-center gap-2 rounded-sm border border-[#52e0ff]/60 bg-[#52e0ff]/10 px-7 py-3.5 font-mono text-sm uppercase tracking-[0.2em] text-[#a8ecff] transition-all hover:bg-[#52e0ff]/20"
              style={{ boxShadow: "0 0 30px rgba(82,224,255,0.15)" }}
            >
              Enter Focus
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </button>
            <a
              href="#layers"
              className="flex cursor-pointer items-center gap-2 rounded-sm border border-white/15 px-7 py-3.5 font-mono text-sm uppercase tracking-[0.2em] text-white/70 transition-colors hover:border-white/40 hover:text-white"
            >
              The {ACTIVE_LAYERS.length} layers
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2"
          >
            {[
              ["10", "analysis layers"],
              ["1", "OMNI super layer"],
              ["100%", "on-device engine"],
              ["$0", "forever"],
            ].map(([n, l]) => (
              <div key={l} className="flex items-baseline gap-2">
                <span className="font-mono text-xl text-[#52e0ff]">{n}</span>
                <span className="hud-label">{l}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <div className="relative z-10 flex justify-center pb-8">
          <a href="#layers" className="hud-label flex flex-col items-center gap-2 text-white/50">
            <span>scroll</span>
            <span className="animate-bounce">▾</span>
          </a>
        </div>
      </section>

      {/* ============ LAYERS ============ */}
      <section id="layers" className="relative px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="hud-label mb-3 text-[#52e0ff]">// SELECT A LAYER</div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Ten layers. One reality.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#8fb8d8]/70">
            Pick a layer from the Focus bar and the scene re-interprets itself.
            History ghost-pastes your past captures. Inscriptions reads the
            text around you with on-device OCR. OMNI renders every layer at
            once — the way the Focus was meant to be used.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {ACTIVE_LAYERS.map((layer, i) => {
              const Icon = LAYER_ICONS[layer.id];
              return (
                <motion.div
                  key={layer.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                  className="group relative rounded-sm border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/25"
                >
                  <div
                    className="absolute left-0 top-0 h-6 w-px"
                    style={{ backgroundColor: layer.color }}
                  />
                  <div className="flex items-center justify-between">
                    <Icon
                      className="size-5 transition-transform group-hover:scale-110"
                      style={{ color: layer.color }}
                    />
                    <span className="font-mono text-[9px] text-white/30">
                      [{layer.hotkey}]
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-sm font-semibold tracking-wide">
                    {layer.name}
                  </h3>
                  <p className="mt-1 text-[11px] leading-snug text-[#8fb8d8]/60">
                    {layer.tagline}
                  </p>
                </motion.div>
              );
            })}

            {/* OMNI super layer card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="relative col-span-2 rounded-sm border border-[#e8f6ff]/30 bg-[#e8f6ff]/[0.04] p-4 md:col-span-3 lg:col-span-5"
              style={{ boxShadow: "0 0 40px rgba(232,246,255,0.06)" }}
            >
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div className="flex size-12 items-center justify-center rounded-sm border border-[#e8f6ff]/40">
                  <Layers className="size-6 text-[#e8f6ff]" />
                </div>
                <div className="flex-1">
                  <div className="hud-label mb-1 text-[#e8f6ff]/80">SUPER LAYER · [O]</div>
                  <h3 className="font-display text-xl font-bold text-[#e8f6ff]">OMNI</h3>
                  <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#cfe3f5]/70">
                    Every layer rendered at once — history ghosts, inscriptions,
                    energy filaments, weather, activity pings, biosphere
                    bloom, structural brackets, signals and anomalies, fused
                    into a single dense overlay with live counters.
                  </p>
                </div>
                <span className="font-mono text-[10px] text-[#e8f6ff]/50">
                  LAYERS + OMNI = {ACTIVE_LAYERS.length + 1} MODES
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============ ENGINE ============ */}
      <section className="border-y border-white/10 bg-[#03070f]/60 px-6 py-24 sm:px-10">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="hud-label mb-3 text-[#7dff9b]">// THE SIGNAL ENGINE</div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Real analysis. Zero fakery.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-[#8fb8d8]/75">
              Every overlay is computed from something real in the frame or the
              environment. The Signal Engine runs a full vision pipeline on
              each frame — luminance, contrast, Sobel edge mass, vegetation
              signal, color saliency, inter-frame motion — then maps the
              results to layers and flags anomalies against your own capture
              baseline.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                {
                  icon: Cpu,
                  text: "On-device vision engine — camera frames never leave your device.",
                },
                {
                  icon: ScrollText,
                  text: "On-device OCR (Tesseract) reads inscriptions with no uploads.",
                },
                {
                  icon: CloudSun,
                  text: "Weather telemetry from Open-Meteo — free, keyless, always.",
                },
                {
                  icon: History,
                  text: "Captures archive to Convex so the History layer ghosts your past.",
                },
                {
                  icon: ShieldCheck,
                  text: "Optional free-tier cloud brain (SambaNova) — Phanes works without it.",
                },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-[13.5px] text-white/75">
                  <Icon className="mt-0.5 size-4 shrink-0 text-[#52e0ff]" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* pipeline visual */}
          <div className="hud-panel rounded-sm p-5 font-mono text-[11.5px] leading-relaxed">
            <div className="hud-label mb-3 text-[#52e0ff]">signal_engine.log</div>
            {[
              ["[frame]", "downscale → luma map → Sobel edges", "#52e0ff"],
              ["[vision]", "contrast, saturation, vegetation, saliency grid", "#52e0ff"],
              ["[motion]", "inter-frame delta vs previous pass", "#ff8fa3"],
              ["[ocr]", "tesseract.js on-device word extraction", "#c3a1ff"],
              ["[weather]", "open-meteo current conditions (lat, lng)", "#6fb5ff"],
              ["[layers]", "map features → 10 layer planes", "#7dff9b"],
              ["[baseline]", "mean of your archived captures", "#ffb454"],
              ["[anomaly]", "z-score deviations vs baseline", "#ff5d6c"],
              ["[omni]", "fuse all planes → super layer", "#e8f6ff"],
            ].map(([tag, line, color]) => (
              <div key={line} className="flex gap-2">
                <span style={{ color }}>[{tag}]</span>
                <span className="text-[#cfe3f5]/80">{line}</span>
              </div>
            ))}
            <div className="mt-4 border-t border-white/10 pt-3 text-[10px] text-white/40">
              Phanes works forever at zero cost — local engine, free weather
              link, free Convex tier. An optional SambaNova key unlocks deeper
              LLM reasoning on the same telemetry.
            </div>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="relative overflow-hidden px-6 py-28 text-center sm:px-10">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at 50% 120%, rgba(82,224,255,0.14), transparent 60%)",
          }}
        />
        <div className="relative">
          <div className="hud-label mb-4 text-[#52e0ff]">// INITIALIZE</div>
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
            Put on the Focus.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[#8fb8d8]/75">
            Sign in, point your lens at anything, and start layering reality.
            Capture scenes now — the History layer will remember them forever.
          </p>
          <button
            type="button"
            onClick={enterFocus}
            className="group mx-auto mt-9 flex cursor-pointer items-center gap-2 rounded-sm border border-[#52e0ff]/60 bg-[#52e0ff]/10 px-8 py-4 font-mono text-sm uppercase tracking-[0.2em] text-[#a8ecff] transition-all hover:bg-[#52e0ff]/20"
            style={{ boxShadow: "0 0 40px rgba(82,224,255,0.18)" }}
          >
            Enter Focus
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-[#52e0ff]">◈</span>
            <span className="font-display text-sm font-semibold tracking-[0.25em]">PHANES</span>
          </div>
          <p className="hud-label text-white/35">
            Focus Intelligence · on-device analysis · free forever
          </p>
        </div>
      </footer>
    </div>
  );
}