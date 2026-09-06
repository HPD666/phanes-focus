import { useCallback, useEffect, useRef, useState } from "react";
import { SignalEngine, thumbnailFromCanvas, type FrameMetrics } from "@/lib/vision";
import { SynthScene } from "@/lib/synth";
import type { NetworkInfo } from "@/lib/ai";

export type FeedMode = "camera" | "synthetic" | "off";

export interface SceneCapture {
  thumb: string;
  metrics: FrameMetrics;
  lat: number | null;
  lng: number | null;
  heading: number;
}

interface Geo {
  lat: number | null;
  lng: number | null;
  alt: number | null;
}

interface ConnectionLike {
  downlink?: number;
  rtt?: number;
  effectiveType?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

/**
 * Owns the live feed (camera or synthetic), the analysis loop and device
 * telemetry. The camera is preferred; any failure (permission, no device,
 * insecure context) falls back to the synthetic environment, which is always
 * labeled as such in the HUD.
 */
export function useScene() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sceneCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null); // latest frame, updated by the analysis loop

  const [feed, setFeed] = useState<FeedMode>("off");
  const [frameCanvas, setFrameCanvas] = useState<HTMLCanvasElement | null>(null);
  const [metrics, setMetrics] = useState<FrameMetrics | null>(null);
  const [geo, setGeo] = useState<Geo>({ lat: null, lng: null, alt: null });
  const [heading, setHeading] = useState(0);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const synthRef = useRef<SynthScene | null>(null);
  const engineRef = useRef(new SignalEngine());
  const rafRef = useRef(0);
  const frameCountRef = useRef(0);
  const watchRef = useRef<number | null>(null);
  const feedRef = useRef<FeedMode>("off");

  const pickSource = useCallback((): CanvasImageSource | null => {
    const video = videoRef.current;
    if (feedRef.current === "camera" && video && video.readyState >= 2) {
      return video;
    }
    const canvas = sceneCanvasRef.current;
    if (feedRef.current === "synthetic" && canvas && canvas.width > 0) {
      return canvas;
    }
    return null;
  }, []);

  // Camera acquisition (or fall back to synthetic)
  const startCamera = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      // a newer boot may have already claimed the feed (StrictMode remount)
      if (streamRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      setCameraError(null);
      feedRef.current = "camera";
      setFeed("camera");
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : "Camera unavailable",
      );
      // fall back to synthetic feed
      if (feedRef.current !== "synthetic") {
        feedRef.current = "synthetic";
        setFeed("synthetic");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const toggleFeed = useCallback(async () => {
    if (feedRef.current === "camera") {
      stopCamera();
      feedRef.current = "synthetic";
      setFeed("synthetic");
    } else {
      await startCamera();
    }
  }, [startCamera, stopCamera]);

  // Boot: camera first, synthetic as fallback
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- camera boot resolves asynchronously (await), so setState only fires from a promise continuation
    void startCamera();
    return () => {
      stopCamera();
      synthRef.current?.stop();
      cancelAnimationFrame(rafRef.current);
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, [startCamera, stopCamera]);

  // Synthetic scene lifecycle
  useEffect(() => {
    const canvas = sceneCanvasRef.current;
    if (!canvas) return;
    if (feed === "synthetic") {
      synthRef.current?.stop();
      const scene = new SynthScene(canvas, { seed: 227, interactive: false });
      scene.setHour(new Date().getHours() + new Date().getMinutes() / 60);
      synthRef.current = scene;
      scene.start();
      // keep the canvas sized even if CSS resizes
      const ro = new ResizeObserver(() => scene.resize());
      ro.observe(canvas);
      return () => {
        ro.disconnect();
        scene.stop();
      };
    }
  }, [feed]);

  // Analysis loop — sizes the frame canvas to the active source (video or
  // synthetic) and runs the Signal Engine on every fourth frame.
  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      rafRef.current = requestAnimationFrame(loop);
      frameCountRef.current++;
      if (frameCountRef.current % 4 !== 0) return;
      const source = pickSource();
      if (!source) return;
      const el = source as HTMLVideoElement | HTMLCanvasElement;
      const sw = "videoWidth" in el ? el.videoWidth : el.width;
      const sh = "videoHeight" in el ? el.videoHeight : el.height;
      if (!sw || !sh) return;
      const cap = 960;
      const scale = Math.min(1, cap / Math.max(sw, 1));
      const w = Math.max(1, Math.round(sw * scale));
      const h = Math.max(1, Math.round(sh * scale));
      let fCanvas = frameCanvasRef.current;
      if (!fCanvas) {
        fCanvas = document.createElement("canvas");
        frameCanvasRef.current = fCanvas;
        setFrameCanvas(fCanvas);
      }
      if (fCanvas.width !== w || fCanvas.height !== h) {
        fCanvas.width = w;
        fCanvas.height = h;
      }
      const fctx = fCanvas.getContext("2d");
      if (!fctx) return;
      fctx.drawImage(source, 0, 0, w, h);
      let imageData: ImageData;
      try {
        imageData = fctx.getImageData(0, 0, w, h);
      } catch {
        return; // tainted canvas (should not happen)
      }
      const m = engineRef.current.analyze(imageData);
      if (!cancelled) setMetrics(m);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [pickSource, feed]);

  // Geolocation
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGeo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          alt: pos.coords.altitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  // Compass / orientation
  useEffect(() => {
    const onOrientation = (e: DeviceOrientationEvent) => {
      const webkit = (e as DeviceOrientationEvent & {
        webkitCompassHeading?: number;
      }).webkitCompassHeading;
      if (typeof webkit === "number") {
        setHeading(webkit);
      } else if (typeof e.alpha === "number") {
        setHeading((360 - e.alpha + 360) % 360);
      }
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, []);

  // Network information
  useEffect(() => {
    const conn = (
      navigator as Navigator & { connection?: ConnectionLike }
    ).connection;
    if (!conn) return;
    const update = () => {
      setNetwork({
        downlink: conn.downlink,
        rtt: conn.rtt,
        type: conn.effectiveType,
      });
    };
    update();
    conn.addEventListener?.("change", update);
    return () => conn.removeEventListener?.("change", update);
  }, []);

  const capture = useCallback((): SceneCapture | null => {
    const source = pickSource();
    if (!source) return null;
    const fCanvas = frameCanvasRef.current;
    if (!fCanvas) return null;
    const cap = document.createElement("canvas");
    cap.width = fCanvas.width;
    cap.height = fCanvas.height;
    const ctx = cap.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, cap.width, cap.height);
    const thumb = thumbnailFromCanvas(cap, 200, 0.55);
    const metrics = engineRef.current.analyze(ctx.getImageData(0, 0, cap.width, cap.height));
    setCapturing(true);
    window.setTimeout(() => setCapturing(false), 900);
    return {
      thumb,
      metrics,
      lat: geo.lat,
      lng: geo.lng,
      heading,
    };
  }, [pickSource, geo, heading]);    return {
    videoRef,
    sceneCanvasRef,
    frameCanvas,
    feed,
    metrics,
    geo,
    heading,
    network,
    capturing,
    cameraError,
    toggleFeed,
    capture,
  };
}