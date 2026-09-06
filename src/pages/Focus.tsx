import { api } from "@/convex/_generated/api";
import { HudChrome } from "@/components/focus/HudChrome";
import { LayerBar } from "@/components/focus/LayerBar";
import { Radar } from "@/components/focus/Radar";
import { ReadoutPanel } from "@/components/focus/ReadoutPanel";
import { CaptureButton } from "@/components/focus/CaptureButton";
import { AiPanel } from "@/components/focus/AiPanel";
import { LayerOverlays, type HistoryCapture, type ActivityPing } from "@/components/focus/LayerOverlays";
import { useScene } from "@/hooks/use-scene";
import { useOcr } from "@/hooks/use-ocr";
import { useAuth } from "@/hooks/use-auth";
import { LAYER_MAP, type LayerId } from "@/lib/layers";
import { detectAnomalies, type FrameMetrics } from "@/lib/vision";
import { fetchWeather, type WeatherNow } from "@/lib/weather";
import type { AiContext } from "@/lib/ai";
import { distanceM, formatTime } from "@/lib/geo";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function Focus() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scene = useScene();
  const {
    videoRef,
    sceneCanvasRef,
    frameCanvas,
    feed,
    metrics,
    geo,
    heading,
    network,
    capturing,
    toggleFeed,
    capture,
  } = scene;

  const [activeLayer, setActiveLayer] = useState<LayerId>("core");
  const [aiOpen, setAiOpen] = useState(false);
  const [time, setTime] = useState(() => formatTime(Date.now()));
  const [weather, setWeather] = useState<WeatherNow | null>(null);

  const captures = useQuery(api.captures.listForUser);
  const activity = useQuery(api.captures.recentActivity);
  const createCapture = useMutation(api.captures.create);
  const cloudAsk = useAction(api.captures.ask);

  const activeOcr = activeLayer === "inscriptions" || activeLayer === "omni";
  const { items: ocrItems, status: ocrStatus } = useOcr(activeOcr, frameCanvas);

  const layer = LAYER_MAP[activeLayer];

  // clock
  useEffect(() => {
    const t = setInterval(() => setTime(formatTime(Date.now())), 1000);
    return () => clearInterval(t);
  }, []);

  // weather — fetched when a fix is available, refreshed periodically
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (geo.lat !== null && geo.lng !== null) {
        const w = await fetchWeather(geo.lat, geo.lng);
        if (!cancelled && w) setWeather(w);
      }
    };
    void load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [geo.lat, geo.lng]);

  // operator baseline from archived captures
  const baseline = useMemo<FrameMetrics | null>(() => {
    if (!captures || captures.length === 0) return null;
    const recent = captures.slice(0, 20);
    const mean = (k: keyof FrameMetrics) =>
      recent.reduce((s, c) => s + (c.metrics[k] as number), 0) / recent.length;
    return {
      brightness: mean("brightness"),
      contrast: mean("contrast"),
      saturation: mean("saturation"),
      edgeDensity: mean("edgeDensity"),
      vegetationIndex: mean("vegetationIndex"),
      motion: mean("motion"),
      anomalyScore: mean("anomalyScore"),
      dominantColors: [],
      hotspots: recent.flatMap((c) => c.metrics.hotspots).slice(0, 9) as FrameMetrics["hotspots"],
    };
  }, [captures]);

  const anomalies = useMemo(
    () => (metrics ? detectAnomalies(metrics, baseline) : []),
    [metrics, baseline],
  );

  const historyCaptures = useMemo<HistoryCapture[]>(
    () =>
      (captures ?? []).map((c) => ({
        id: c._id,
        createdAt: c.createdAt,
        thumb: c.thumb,
        lat: c.lat,
        lng: c.lng,
        heading: c.heading,
        metrics: c.metrics as unknown as FrameMetrics,
      })),
    [captures],
  );

  const activityPings = useMemo<ActivityPing[]>(
    () =>
      (activity ?? []).map((a) => ({
        id: a.id,
        createdAt: a.createdAt,
        lat: a.lat,
        lng: a.lng,
      })),
    [activity],
  );

  const nearbyCount = useMemo(() => {
    if (geo.lat === null || geo.lng === null) return historyCaptures.length;
    return historyCaptures.filter(
      (c) => distanceM(geo.lat!, geo.lng!, c.lat, c.lng) <= 120,
    ).length;
  }, [geo.lat, geo.lng, historyCaptures]);

  const aiCtx = useMemo<AiContext>(
    () => ({
      layer: layer.id,
      layerName: layer.name,
      metrics,
      weather,
      lat: geo.lat,
      lng: geo.lng,
      heading,
      captureCount: historyCaptures.length,
      nearbyCaptureCount: nearbyCount,
      ocr: ocrItems.map((i) => i.text),
      anomalies,
      feed,
      network,
      timeOfDay: new Date().toLocaleTimeString(),
      activeSince: "session start",
    }),
    [layer, metrics, weather, geo, heading, historyCaptures.length, nearbyCount, ocrItems, anomalies, feed, network],
  );

  const handleCapture = async () => {
    const shot = capture();
    if (!shot) {
      toast.error("No frame available to archive");
      return;
    }
    if (!user) return;
    try {
      await createCapture({
        lat: shot.lat ?? 0,
        lng: shot.lng ?? 0,
        heading: shot.heading,
        thumb: shot.thumb,
        metrics: shot.metrics,
        ocr: ocrItems.map((i) => ({
          text: i.text,
          confidence: i.confidence,
          x: i.x,
          y: i.y,
        })),
      });
      toast.success("Capture archived — History layer updated");
    } catch {
      toast.error("Failed to archive capture");
    }
  };

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-[#02040a] text-white"
      style={{ "--accent": layer.color } as React.CSSProperties}
    >
      {/* live feed */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className={`absolute inset-0 size-full object-cover ${feed === "camera" ? "" : "hidden"}`}
      />
      <canvas
        ref={sceneCanvasRef}
        className={`absolute inset-0 size-full ${feed === "synthetic" ? "" : "hidden"}`}
      />

      {/* layer data over the feed */}
      <LayerOverlays
        layer={activeLayer}
        metrics={metrics}
        weather={weather}
        captures={historyCaptures}
        activity={activityPings}
        geo={{ lat: geo.lat, lng: geo.lng }}
        heading={heading}
        ocr={ocrItems}
        ocrStatus={ocrStatus}
        anomalies={anomalies}
        accent={layer.color}
      />

      {/* HUD chrome */}
      <HudChrome
        feed={feed}
        lat={geo.lat}
        lng={geo.lng}
        heading={heading}
        network={network}
        captureCount={historyCaptures.length}
        accent={layer.color}
        layerCode={layer.code}
        layerName={layer.name}
        ocrStatus={ocrStatus}
        time={time}
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen((v) => !v)}
        onExit={() => navigate("/")}
      />

      {/* radar */}
      <div className="absolute right-3 top-[52px] z-30 hidden md:block">
        <Radar metrics={metrics} anomalies={anomalies} accent={layer.color} />
      </div>

      {/* metrics */}
      <ReadoutPanel
        layer={layer}
        metrics={metrics}
        weather={weather}
        network={network}
        anomalies={anomalies}
        baselineCaptureCount={historyCaptures.length}
      />

      {/* capture + feed */}
      <CaptureButton
        capturing={capturing}
        accent={layer.color}
        feed={feed}
        onCapture={() => void handleCapture()}
        onToggleFeed={() => void toggleFeed()}
      />

      {/* layer selector */}
      <LayerBar active={activeLayer} onSelect={setActiveLayer} />

      {/* AI panel */}
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} ctx={aiCtx} cloudAsk={cloudAsk} />
    </div>
  );
}