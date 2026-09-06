import { useEffect, useRef, useState } from "react";
import type { Worker as TesseractWorker } from "tesseract.js";

export interface OcrItem {
  text: string;
  confidence: number;
  x: number; // 0..1
  y: number; // 0..1
}

export type OcrStatus = "idle" | "loading" | "ready" | "offline";

/**
 * Runs Tesseract.js fully in the browser over the current frame canvas.
 * Only active when a layer that reads text is selected. Language data is
 * fetched from the public CDN on first use; if the worker cannot load, the
 * hook reports "offline" and the HUD shows the layer as degraded rather
 * than faking results.
 */
export function useOcr(active: boolean, frameCanvas: HTMLCanvasElement | null) {
  const [items, setItems] = useState<OcrItem[]>([]);
  const [status, setStatus] = useState<OcrStatus>("idle");
  const workerRef = useRef<TesseractWorker | null>(null);
  const busyRef = useRef(false);
  const seenRef = useRef<string[]>([]);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const boot = async () => {
      setStatus("loading");
      try {
        const { createWorker } = await import("tesseract.js");
        if (disposed) return;
        const worker = await createWorker("eng", 1, { logger: () => {} });
        if (disposed) {
          await worker.terminate();
          return;
        }
        workerRef.current = worker;
        setStatus("ready");
        const run = async () => {
          if (busyRef.current || !frameCanvas) return;
          if (frameCanvas.width === 0 || frameCanvas.height === 0) return;
          busyRef.current = true;
          try {
            const result = await worker.recognize(frameCanvas);
            const words = (result?.data?.blocks ?? []).flatMap((b) =>
              (b?.paragraphs ?? []).flatMap((p) =>
                (p?.lines ?? []).flatMap((l) => l?.words ?? []),
              ),
            );
            const now: OcrItem[] = [];
            for (const w of words) {
              const text = (w.text ?? "").trim();
              const conf = w.confidence ?? 0;
              if (text.length < 2 || conf < 55) continue;
              const key = text.toLowerCase();
              if (seenRef.current.includes(key)) continue;
              seenRef.current.push(key);
              if (seenRef.current.length > 40) seenRef.current.shift();
              now.push({
                text,
                confidence: conf,
                x: Math.min(0.95, Math.max(0.05, (w.bbox.x0 + w.bbox.x1) / 2 / frameCanvas.width)),
                y: Math.min(0.9, Math.max(0.1, (w.bbox.y0 + w.bbox.y1) / 2 / frameCanvas.height)),
              });
            }
            if (now.length > 0) {
              setItems((prev) => [...now, ...prev].slice(0, 8));
            }
          } catch {
            // transient recognition failure — ignore
          } finally {
            busyRef.current = false;
          }
        };
        interval = setInterval(run, 6000);
        void run();
      } catch {
        if (!disposed) setStatus("offline");
      }
    };

    void boot();

    return () => {
      disposed = true;
      if (interval) clearInterval(interval);
      const worker = workerRef.current;
      workerRef.current = null;
      if (worker) void worker.terminate();
      setStatus("idle");
    };
  }, [active, frameCanvas]);

  return { items, status };
}