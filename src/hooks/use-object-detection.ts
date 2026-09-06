/**
 * PHANES REAL OBJECT DETECTION
 * ----------------------------
 * Uses TensorFlow.js COCO-SSD (a genuine neural network trained on COCO)
 * to detect real objects in the live camera frame. This runs entirely in
 * the browser — no cloud call, no fake data, no API key required.
 *
 * COCO-SSD recognizes 80 real object categories: chairs, bottles, laptops,
 * people, cars, animals, food, furniture, electronics, and more. Each
 * detection comes with a real confidence score and a pixel-space bounding
 * box computed from the actual frame content.
 *
 * Model: COCO-SSD MobileNet v1 (loaded lazily on first use, ~5 MB).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { ObjectDetection } from "@tensorflow-models/coco-ssd";

export interface DetectedObject {
  /** Real COCO class label, e.g. "chair", "bottle", "laptop", "potted plant" */
  label: string;
  /** Detection confidence 0..1 from the trained model */
  confidence: number;
  /** Normalized bounding box in frame space (0..1) */
  box: { x: number; y: number; w: number; h: number };
}

interface UseObjectDetectionOptions {
  /** The current analysis canvas — refreshed every few frames by use-scene */
  frameCanvas: HTMLCanvasElement | null;
  /** Whether detection is active (e.g. core layer selected) */
  enabled: boolean;
  /** How often to run detection (default every 30 frames ≈ every ~500ms) */
  detectionInterval?: number;
}

/**
 * Loads COCO-SSD lazily and runs real object detection on the current frame.
 * Returns the latest set of detected objects plus loading state.
 */
export function useObjectDetection({
  frameCanvas,
  enabled,
  detectionInterval = 30,
}: UseObjectDetectionOptions) {
  const modelRef = useRef<ObjectDetection | null>(null);
  const [detections, setDetections] = useState<DetectedObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const frameCountRef = useRef(0);
  const busyRef = useRef(false);
  const rafRef = useRef(0);

  // Lazily load the COCO-SSD model
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;

    const load = async () => {
      if (modelRef.current) return;
      setLoading(true);
      try {
        const tf = await import("@tensorflow/tfjs");
        // Use WebGL backend for GPU-accelerated inference
        await tf.setBackend("webgl").catch(() => tf.setBackend("cpu"));
        await tf.ready();
        const cocoSsd = await import("@tensorflow-models/coco-ssd");
        if (disposed) return;
        const model = await cocoSsd.load({
          base: "lite_mobilenet_v1",
        });
        if (disposed) {
          model.dispose();
          return;
        }
        modelRef.current = model;
        setReady(true);
      } catch {
        // Model load failed — detection will remain empty
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void load();

    return () => {
      disposed = true;
    };
  }, [enabled]);

  // Detection loop — runs on every Nth frame to avoid blocking the UI
  useEffect(() => {
    if (!enabled || !ready || !frameCanvas) return;
    let cancelled = false;

    const detect = async () => {
      if (cancelled) return;
      rafRef.current = requestAnimationFrame(detect);
      frameCountRef.current++;
      if (frameCountRef.current % detectionInterval !== 0) return;
      if (busyRef.current) return;
      if (!modelRef.current || !frameCanvas) return;
      if (frameCanvas.width === 0 || frameCanvas.height === 0) return;

      busyRef.current = true;
      try {
        const results = await modelRef.current.detect(frameCanvas);
        if (cancelled) return;
        const mapped: DetectedObject[] = results
          .filter((r) => r.score >= 0.35)
          .map((r) => ({
            label: r.class,
            confidence: r.score,
            box: {
              // COCO-SSD returns pixel coords; normalize to 0..1
              x: Math.max(0, Math.min(1, r.bbox[0] / frameCanvas.width)),
              y: Math.max(0, Math.min(1, r.bbox[1] / frameCanvas.height)),
              w: Math.max(0, Math.min(1, r.bbox[2] / frameCanvas.width)),
              h: Math.max(0, Math.min(1, r.bbox[3] / frameCanvas.height)),
            },
          }))
          .sort((a, b) => b.confidence - a.confidence);
        setDetections(mapped);
      } catch {
        // Transient inference error — skip this frame
      } finally {
        busyRef.current = false;
      }
    };

    rafRef.current = requestAnimationFrame(detect);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, ready, frameCanvas, detectionInterval]);

  // Cleanup model on unmount
  useEffect(() => {
    return () => {
      modelRef.current?.dispose();
      modelRef.current = null;
    };
  }, []);

  /**
   * Returns the single most confident detection, or null.
   * This is the "primary lock" — the object the Focus is currently aimed at.
   */
  const primaryDetection = useCallback((): DetectedObject | null => {
    return detections.length > 0 ? detections[0] : null;
  }, [detections]);

  return {
    detections,
    primaryDetection,
    loading,
    ready,
    modelLoaded: ready,
  };
}
