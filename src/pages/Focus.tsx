import { api } from "@/convex/_generated/api";
import { HudChrome } from "@/components/focus/HudChrome";
import { LayerBar } from "@/components/focus/LayerBar";
import { Radar } from "@/components/focus/Radar";
import { ReadoutPanel } from "@/components/focus/ReadoutPanel";
import { CaptureButton } from "@/components/focus/CaptureButton";
import { AiPanel } from "@/components/focus/AiPanel";
import { ObjectScan } from "@/components/focus/ObjectScan";
import { ScanFrame } from "@/components/focus/ScanFrame";
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
  const [scanHit, setScanHit] = useState<import("@/convex/objectScan").Hit | null>(null);
  const scanCooldown = useRef(0);
  const lastScanKey = useRef(0);

  const captures = useQuery(api.captures.listForUser);
  const activity = useQuery(api.captures.recentActivity);
  const createCapture = useMutation(api.captures.create);
  const identifyObject = useAction(api.objectScan.identifyObject);
  const cloudAsk = useAction(api.captures.ask);

  const layerCanScan = activeLayer === "core" || activeLayer === "omni";

  // Live object scan cooldown refresh
  useEffect(() => {
    if (scanCooldown.current > 0) {
      const t = setTimeout(
        () => (scanCooldown.current = Math.max(0, scanCooldown.current - 100)),
        100,
      );
      return () => clearTimeout(t);
    }
  }, [scanCooldown.current]);

  const capturesList = captures ?? [];
  const activityList = activity ?? [];

  const capturesForOverlay = useMemo<HistoryCapture[]>(
    () =>
      capturesList.map((c) => ({
        id: c._id,
        createdAt: c.createdAt,
        thumb: c.thumb,
        lat: c.lat,
        lng: c.lng,
        heading: c.heading,
        metrics: c.metrics as unknown as FrameMetrics,
      })),
    [capturesList],
  );

  const activityPings = useMemo<ActivityPing[]>(
    () =>
      activityList.map((a) => ({
        id: a.id,
        createdAt: a.createdAt,
        lat: a.lat,
        lng: a.lng,
      })),
    [activityList],
  );

  const nearbyCount = useMemo(() => {
    if (geo.lat === null || geo.lng === null) return capturesForOverlay.length;
    return capturesForOverlay.filter(
      (c) => distanceM(geo.lat!, geo.lng!, c.lat, c.lng) <= 120,
    ).length;
  }, [geo.lat, geo.lng, capturesForOverlay]);

  const aiCtx = useMemo<AiContext>(
    () => ({
      layer: LAYER_MAP[activeLayer].id,
      layerName: LAYER_MAP[activeLayer].name,
      metrics,
      weather,
      lat: geo.lat,
      lng: geo.lng,
      heading,
      captureCount: capturesForOverlay.length,
      nearbyCaptureCount: nearbyCount,
      ocr: [],
      anomalies: [],
      feed,
      network,
      timeOfDay: new Date().toLocaleTimeString(),
      activeSince: "session start",
    }),
    [activeLayer, metrics, weather, geo, heading, capturesForOverlay.length, nearbyCount, feed, network],
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
        ocr: [],
      });
      toast.success("Capture archived — History layer updated");
    } catch {
      toast.error("Failed to archive capture");
    }

    if (shot.thumb && layerCanScan) {
      setScanHit(null);
      lastScanKey.current += 1;
      const key = lastScanKey.current;
      scanCooldown.current = 1600;
      const dataUrl = shot.thumb.startsWith("data:") ? shot.thumb : `data:image/jpeg;base64,${shot.thumb.split(",")[1] ?? ""}`;
      identifyObject({ thumbBase64: dataUrl }).then((hit) => {
        if (hit && key === lastScanKey.current) {
          setScanHit(hit as import("@/convex/objectScan").Hit);
        }
      });
    }
  };

  const handleRescan = useCallback(() => {
    if (scanCooldown.current > 0 || !frameCanvas) return;
    scanCooldown.current = 1600;
    lastScanKey.current += 1;
    const key = lastScanKey.current;
    const dataUrl = frameCanvas.toDataURL("image/jpeg", 0.75);
    identifyObject({ thumbBase64: dataUrl }).then((hit) => {
      if (hit && key === lastScanKey.current) {
        setScanHit(hit as import("@/convex/objectScan").Hit);
      }
    });
  }, [frameCanvas, identifyObject]);

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-[#02040a] text-white"
      style={{ "--accent": LAYER_MAP[activeLayer].color } as React.CSSProperties}
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

      {/* live object bounding frame */}
      {activeLayer === "core" && scanHit?.box && (
        <ScanFrame
          box={scanHit.box}
          accent={LAYER_MAP[activeLayer].color}
          label={scanHit.label}
        />
      )}

      {/* live object scan HUD panel */}
      <ObjectScan
        hit={scanHit}
        accent={LAYER_MAP[activeLayer].color}
        onDismiss={() => setScanHit(null)}
        onRescan={handleRescan}
        canScan={layerCanScan}
        cooldown={scanCooldown.current}
      />

      {/* layer data over the feed */}
      <LayerOverlays
        layer={activeLayer}
        metrics={metrics}
        weather={weather}
        captures={capturesForOverlay}
        activity={activityPings}
        geo={{ lat: geo.lat, lng: geo.lng }}
        heading={heading}
        ocr={[]}
        ocrStatus="offline"
        anomalies={[]}
        accent={LAYER_MAP[activeLayer].color}
      />

      {/* HUD chrome */}
      <HudChrome
        feed={feed}
        lat={geo.lat}
        lng={geo.lng}
        heading={heading}
        network={network}
        captureCount={capturesForOverlay.length}
        accent={LAYER_MAP[activeLayer].color}
        layerCode={LAYER_MAP[activeLayer].code}
        layerName={LAYER_MAP[activeLayer].name}
        ocrStatus="offline"
        time={time}
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen((v) => !v)}
        onExit={() => navigate("/")}
        onOpenGallery={() => navigate("/gallery")}
        cloudAvailable={Boolean(cloudAsk)}
        cloudEnabled={false}
        onToggleCloud={() => {}}
      />

      {/* radar */}
      <div className="absolute right-3 top-[52px] z-30 hidden md:block">
        <Radar metrics={metrics} anomalies={[]} accent={LAYER_MAP[activeLayer].color} />
      </div>

      {/* metrics */}
      <ReadoutPanel
        layer={LAYER_MAP[activeLayer]}
        metrics={metrics}
        weather={weather}
        network={network}
        anomalies={[]}
        baselineCaptureCount={capturesForOverlay.length}
      />

      {/* capture + feed */}
      <CaptureButton
        capturing={capturing}
        accent={LAYER_MAP[activeLayer].color}
        feed={feed}
        onCapture={() => void handleCapture()}
        onToggleFeed={() => void toggleFeed()}
      />

      {/* layer selector */}
      <LayerBar active={activeLayer} onSelect={setActiveLayer} />

      {/* AI panel */}
      <AiPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        ctx={aiCtx}
        cloudAsk={cloudAsk}
        cloudAvailable={Boolean(cloudAsk)}
        cloudEnabled={false}
        onToggleCloud={() => {}}
      />
    </div>
  );
}
