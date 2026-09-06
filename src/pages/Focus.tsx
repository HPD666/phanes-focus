import { api } from "@/convex/_generated/api";
import { HudChrome } from "@/components/focus/HudChrome";
import { LayerBar } from "@/components/focus/LayerBar";
import { Radar } from "@/components/focus/Radar";
import { ReadoutPanel } from "@/components/focus/ReadoutPanel";
import { CaptureButton } from "@/components/focus/CaptureButton";
import { AiPanel } from "@/components/focus/AiPanel";
import { ObjectScan } from "@/components/focus/ObjectScan";
import { LayerOverlays, type HistoryCapture, type ActivityPing } from "@/components/focus/LayerOverlays";
import { useScene } from "@/hooks/use-scene";
import { useOcr } from "@/hooks/use-ocr";
import { useObjectDetection } from "@/hooks/use-object-detection";
import { useAuth } from "@/hooks/use-auth";
import { LAYER_MAP, type LayerId } from "@/lib/layers";
import { detectAnomalies, type FrameMetrics } from "@/lib/vision";
import { fetchWeather, type WeatherNow } from "@/lib/weather";
import type { AiContext } from "@/lib/ai";
import { distanceM, formatTime } from "@/lib/geo";
import type { Hit } from "@/convex/objectScan";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [scanHit, setScanHit] = useState<Hit | null>(null);
  const [scanPending, setScanPending] = useState(false);
  const scanCooldown = useRef(0);
  const lastScanKey = useRef(0);

  const captures = useQuery(api.captures.listForUser);
  const activity = useQuery(api.captures.recentActivity);
  const createCapture = useMutation(api.captures.create);
  const identifyObject = useAction(api.objectScan.identifyObject);
  const cloudAsk = useAction(api.captures.ask);

  const [cloudEnabled, setCloudEnabled] = useState(false);
  const cloudAvailable = Boolean(cloudAsk);
  const onToggleCloud = useCallback(() => setCloudEnabled((v) => !v), []);

  const activeOcr = activeLayer === "inscriptions" || activeLayer === "omni";
  const { items: ocrItems, status: ocrStatus } = useOcr(activeOcr, frameCanvas);

  const layer = LAYER_MAP[activeLayer];
  const layerCanScan = activeLayer === "core" || activeLayer === "omni";

  // Real TF.js COCO-SSD object detection on the live frame
  const { detections, primaryDetection } = useObjectDetection({
    frameCanvas,
    enabled: layerCanScan,
  });

  // clock
  useEffect(() => {
    const t = setInterval(() => setTime(formatTime(Date.now())), 1000);
    return () => clearInterval(t);
  }, []);

  // weather
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
    return () => { cancelled = true; clearInterval(t); };
  }, [geo.lat, geo.lng]);

  // Scan cooldown refresh
  useEffect(() => {
    if (scanCooldown.current > 0) {
      const t = setTimeout(
        () => (scanCooldown.current = Math.max(0, scanCooldown.current - 100)),
        100,
      );
      return () => clearTimeout(t);
    }
  }, [scanCooldown.current]);

  // operator baseline
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
    () => (captures ?? []).map((c) => ({
      id: c._id, createdAt: c.createdAt, thumb: c.thumb,
      lat: c.lat, lng: c.lng, heading: c.heading,
      metrics: c.metrics as unknown as FrameMetrics,
    })),
    [captures],
  );

  const activityPings = useMemo<ActivityPing[]>(
    () => (activity ?? []).map((a) => ({
      id: a.id, createdAt: a.createdAt, lat: a.lat, lng: a.lng,
    })),
    [activity],
  );

  const nearbyCount = useMemo(() => {
    if (geo.lat === null || geo.lng === null) return historyCaptures.length;
    return historyCaptures.filter(
      (c) => distanceM(geo.lat!, geo.lng!, c.lat, c.lng) <= 120,
    ).length;
  }, [geo.lat, geo.lng, historyCaptures]);

  const aiCtx = useMemo<AiContext>(() => ({
    layer: layer.id, layerName: layer.name, metrics, weather,
    lat: geo.lat, lng: geo.lng, heading,
    captureCount: historyCaptures.length, nearbyCaptureCount: nearbyCount,
    ocr: ocrItems.map((i) => i.text), anomalies, feed, network,
    timeOfDay: new Date().toLocaleTimeString(), activeSince: "session start",
  }), [layer, metrics, weather, geo, heading, historyCaptures.length, nearbyCount, ocrItems, anomalies, feed, network]);

  /**
   * Real object scan: TF.js COCO-SSD detects the object in the frame,
   * then the Convex action enriches it with DuckDuckGo web data.
   */
  const enqueueObjectScan = useCallback(
    async (thumbBase64: string) => {
      if (!layerCanScan) return;
      setScanHit(null);
      setScanPending(true);
      lastScanKey.current += 1;
      const key = lastScanKey.current;
      scanCooldown.current = 2000;

      try {
        const det = primaryDetection();
        if (det && key === lastScanKey.current) {
          const enriched = await identifyObject({
            thumbBase64,
            detectedLabel: det.label,
            confidence: det.confidence,
            box: det.box,
          });
          if (key === lastScanKey.current) {
            setScanHit(enriched as Hit);
          }
        } else if (key === lastScanKey.current) {
          const enriched = await identifyObject({
            thumbBase64,
            detectedLabel: "unknown object",
            confidence: 0.3,
          });
          if (key === lastScanKey.current && enriched) {
            setScanHit(enriched as Hit);
          }
        }
      } catch {
        if (key === lastScanKey.current) setScanPending(false);
      } finally {
        if (key === lastScanKey.current) setScanPending(false);
      }
    },
    [identifyObject, layerCanScan, primaryDetection],
  );

  const handleRescan = useCallback(() => {
    if (scanPending || scanCooldown.current > 0) return;
    const shot = capture();
    if (shot?.thumb) enqueueObjectScan(shot.thumb);
  }, [capture, enqueueObjectScan, scanPending]);

  const handleCapture = async () => {
    const shot = capture();
    if (!shot) { toast.error("No frame available to archive"); return; }
    if (!user) return;
    try {
      await createCapture({
        lat: shot.lat ?? 0, lng: shot.lng ?? 0, heading: shot.heading,
        thumb: shot.thumb, metrics: shot.metrics,
        ocr: ocrItems.map((i) => ({ text: i.text, confidence: i.confidence, x: i.x, y: i.y })),
      });
      toast.success("Capture archived — History layer updated");
    } catch { toast.error("Failed to archive capture"); }
    if (shot.thumb) enqueueObjectScan(shot.thumb);
  };

  // Auto-scan when high-confidence detection appears
  const autoScanCountRef = useRef(0);
  useEffect(() => {
    if (!layerCanScan || scanPending || scanCooldown.current > 0) return;
    const det = primaryDetection();
    if (!det || det.confidence < 0.55) return;
    autoScanCountRef.current++;
    if (autoScanCountRef.current % 3 !== 0) return;
    scanCooldown.current = 5000;
    void enqueueObjectScan(frameCanvas?.toDataURL("image/jpeg", 0.7) ?? "");
  }, [detections, layerCanScan, scanPending, primaryDetection, enqueueObjectScan, frameCanvas]);

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

      {/* real-time bounding boxes for all detected objects */}
      {layerCanScan && detections.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-[15]">
          {detections.map((d, i) => (
            <div
              key={`${d.label}-${i}`}
              className="absolute transition-all duration-300"
              style={{
                left: `${d.box.x * 100}%`,
                top: `${d.box.y * 100}%`,
                width: `${d.box.w * 100}%`,
                height: `${d.box.h * 100}%`,
              }}
            >
              <div className="absolute left-0 top-0 border-l-2 border-t-2" style={{ borderColor: i === 0 ? layer.color : `${layer.color}88` }} />
              <div className="absolute right-0 top-0 border-r-2 border-t-2" style={{ borderColor: i === 0 ? layer.color : `${layer.color}88` }} />
              <div className="absolute bottom-0 left-0 border-b-2 border-l-2" style={{ borderColor: i === 0 ? layer.color : `${layer.color}88` }} />
              <div className="absolute bottom-0 right-0 border-b-2 border-r-2" style={{ borderColor: i === 0 ? layer.color : `${layer.color}88` }} />
              {i === 0 && (
                <div className="absolute inset-0 rounded-sm" style={{ boxShadow: `0 0 16px ${layer.color}55, inset 0 0 12px ${layer.color}22` }} />
              )}
              <div
                className="absolute -top-5 left-0 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.18em]"
                style={{ color: i === 0 ? layer.color : `${layer.color}aa`, textShadow: i === 0 ? `0 0 8px ${layer.color}` : "none" }}
              >
                {d.label.toUpperCase()} {Math.round(d.confidence * 100)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* object scan panel */}
      <ObjectScan
        hit={scanHit}
        accent={layer.color}
        pending={scanPending}
        canScan={layerCanScan}
        cooldown={scanCooldown.current}
        onDismiss={() => setScanHit(null)}
        onRescan={handleRescan}
        allDetections={detections.slice(0, 5)}
      />

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
        onOpenGallery={() => navigate("/gallery")}
        cloudAvailable={cloudAvailable}
        cloudEnabled={cloudEnabled}
        onToggleCloud={onToggleCloud}
      />

      <div className="absolute right-3 top-[52px] z-30 hidden md:block">
        <Radar metrics={metrics} anomalies={anomalies} accent={layer.color} />
      </div>

      <ReadoutPanel
        layer={layer}
        metrics={metrics}
        weather={weather}
        network={network}
        anomalies={anomalies}
        baselineCaptureCount={historyCaptures.length}
      />

      <CaptureButton
        capturing={capturing}
        accent={layer.color}
        feed={feed}
        onCapture={() => void handleCapture()}
        onToggleFeed={() => void toggleFeed()}
      />

      <LayerBar active={activeLayer} onSelect={setActiveLayer} />

      <AiPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        ctx={aiCtx}
        cloudAsk={cloudAsk}
        cloudAvailable={cloudAvailable}
        cloudEnabled={cloudEnabled}
        onToggleCloud={onToggleCloud}
      />
    </div>
  );
}
