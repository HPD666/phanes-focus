import { AnimatePresence, motion } from "framer-motion";
import { Bot, CornerDownLeft, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { phanesAnswer, buildSceneBrief, type AiContext } from "@/lib/ai";

interface Message {
  role: "user" | "ai";
  text: string;
  engine: "local" | "cloud";
}

interface AiPanelProps {
  open: boolean;
  onClose: () => void;
  ctx: AiContext;
  cloudAsk: ((args: { prompt: string; scene: string }) => Promise<string | null>) | null;
}

const SUGGESTIONS = [
  "What do you see?",
  "Any anomalies?",
  "Read the inscriptions",
  "Weather check",
  "What is the history here?",
];

export function AiPanel({ open, onClose, ctx, cloudAsk }: AiPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, thinking]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || thinking) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text, engine: "local" }]);
    setThinking(true);
    try {
      let answer: string | null = null;
      if (cloudAsk) {
        try {
          answer = await cloudAsk({ prompt: text, scene: buildSceneBrief(ctx) });
        } catch {
          answer = null;
        }
      }
      if (answer) {
        setMessages((m) => [...m, { role: "ai", text: answer, engine: "cloud" }]);
      } else {
        await new Promise((r) => setTimeout(r, 650));
        setMessages((m) => [
          ...m,
          { role: "ai", text: phanesAnswer(text, ctx), engine: "local" },
        ]);
      }
    } finally {
      setThinking(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 380, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="pointer-events-auto absolute inset-y-0 right-0 z-40 flex w-[min(92vw,380px)] flex-col border-l border-white/10 bg-[#03080f]/92 backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="size-4" style={{ color: ctx.layer === "omni" ? "#e8f6ff" : "#52e0ff" }} />
              <span className="font-display text-sm font-semibold tracking-[0.2em] text-white">
                PHANES INTELLIGENCE
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hud-label rounded-sm border border-white/10 px-1.5 py-0.5">
                {cloudAsk ? "CLOUD BRAIN" : "ON-DEVICE"}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer text-white/50 transition-colors hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {open && messages.length === 0 && (
              <div className="mr-6 rounded-sm border-l-2 px-3 py-2 text-[12.5px] leading-relaxed text-[#cfeaff]/90" style={{ borderColor: ctx.layer === "omni" ? "#e8f6ff" : "#52e0ff" }}>
                <div className="mb-1 flex items-center gap-1.5">
                  <Sparkles className="size-3" style={{ color: ctx.layer === "omni" ? "#e8f6ff" : "#52e0ff" }} />
                  <span className="hud-label">Phanes · local</span>
                </div>
                <pre className="whitespace-pre-wrap font-sans">{phanesAnswer("status", ctx)}</pre>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-8 rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-[12.5px] leading-relaxed text-white/90"
                    : "mr-6 rounded-sm border-l-2 px-3 py-2 text-[12.5px] leading-relaxed text-[#cfeaff]/90"
                }
                style={m.role === "ai" ? { borderColor: ctx.layer === "omni" ? "#e8f6ff" : "#52e0ff" } : undefined}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <Sparkles className="size-3" style={{ color: ctx.layer === "omni" ? "#e8f6ff" : "#52e0ff" }} />
                  <span className="hud-label">
                    {m.role === "ai" ? `Phanes · ${m.engine === "cloud" ? "cloud" : "local"}` : "Operator"}
                  </span>
                </div>
                <pre className="whitespace-pre-wrap font-sans">{m.text}</pre>
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-2 px-3 py-2 text-[#9fd4f2]/70">
                <Loader2 className="size-3.5 animate-spin" />
                <span className="hud-label">Analyzing telemetry…</span>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="hud-label cursor-pointer rounded-sm border border-white/10 px-2 py-1 transition-colors hover:border-white/30 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about the scene…"
                className="h-9 flex-1 rounded-sm border border-white/15 bg-black/30 px-3 font-mono text-[12px] text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
              <button
                type="submit"
                disabled={thinking || !input.trim()}
                className="flex size-9 cursor-pointer items-center justify-center rounded-sm border border-white/15 text-white/70 transition-colors hover:border-white/40 hover:text-white disabled:opacity-40"
              >
                <CornerDownLeft className="size-4" />
              </button>
            </form>
            <p className="mt-2 text-[9.5px] leading-relaxed text-white/35">
              On-device engine answers only from live telemetry. Optional cloud
              brain runs through SambaNova (free tier) and, when that is
              unavailable, the Vly integration gateway — both free, both wired
              behind the same ask action. No subscription, ever.
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}