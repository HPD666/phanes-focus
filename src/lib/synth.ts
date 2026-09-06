/**
 * SYNTHETIC ENVIRONMENT RENDERER
 * ------------------------------
 * When no camera feed is available the Focus renders a procedural
 * holographic cityscape instead, so the full analysis pipeline (and every
 * layer) still has real pixels to read. The scene is labeled "SYNTHETIC
 * FEED" in the HUD — Phanes never pretends it is a camera.
 */

interface Building {
  x: number; // normalized horizon position
  width: number;
  height: number;
  depth: number;
  hue: number;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  speed: number;
  size: number;
  phase: number;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKIES: { hour: number; sky: [number, number, number]; glow: [number, number, number]; sun: number }[] = [
  { hour: 0, sky: [3, 6, 16], glow: [10, 40, 70], sun: 0 },
  { hour: 5, sky: [12, 16, 34], glow: [90, 70, 40], sun: 0 },
  { hour: 7, sky: [40, 48, 74], glow: [200, 140, 70], sun: 1 },
  { hour: 12, sky: [64, 96, 130], glow: [150, 190, 220], sun: 1 },
  { hour: 17, sky: [46, 54, 88], glow: [230, 120, 70], sun: 1 },
  { hour: 20, sky: [12, 16, 34], glow: [60, 70, 120], sun: 0 },
  { hour: 23, sky: [3, 6, 16], glow: [10, 40, 70], sun: 0 },
];

function skyAt(hour: number): { sky: string; glow: string; sun: number } {
  const h = ((hour % 24) + 24) % 24;
  let a = SKIES[0];
  let b = SKIES[SKIES.length - 1];
  for (let i = 0; i < SKIES.length - 1; i++) {
    if (h >= SKIES[i].hour && h <= SKIES[i + 1].hour) {
      a = SKIES[i];
      b = SKIES[i + 1];
      break;
    }
  }
  const t = Math.min(1, Math.max(0, (h - a.hour) / Math.max(1e-6, b.hour - a.hour)));
  const mix = (x: number[], y: number[]) => x.map((v, i) => Math.round(v + (y[i] - v) * t));
  const sky = mix(a.sky, b.sky);
  const glow = mix(a.glow, b.glow);
  return {
    sky: `rgb(${sky[0]},${sky[1]},${sky[2]})`,
    glow: `rgb(${glow[0]},${glow[1]},${glow[2]})`,
    sun: a.sun + (b.sun - a.sun) * t,
  };
}

export class SynthScene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private t = 0;
  private buildings: Building[] = [];
  private particles: Particle[] = [];
  private buildingsSeed: number;
  private pointerX = 0;
  private pointerY = 0;
  private targetX = 0;
  private targetY = 0;
  private hour = 22;
  private stopped = false;
  private interactive: boolean;

  constructor(canvas: HTMLCanvasElement, opts: { seed?: number; interactive?: boolean } = {}) {
    this.canvas = canvas;
    this.interactive = opts.interactive ?? true;
    this.buildingsSeed = opts.seed ?? 1337;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.resize();
    this.generate(this.buildingsSeed);
    if (this.interactive) {
      const move = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        this.targetX = (e.clientX - r.left) / r.width - 0.5;
        this.targetY = (e.clientY - r.top) / r.height - 0.5;
      };
      canvas.addEventListener("pointermove", move);
      this.cleanupMove = () => canvas.removeEventListener("pointermove", move);
    }
  }

  private cleanupMove: (() => void) | null = null;

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private generate(seed: number) {
    const rand = mulberry(seed);
    const count = 16;
    this.buildings = [];
    for (let i = 0; i < count; i++) {
      this.buildings.push({
        x: 0.04 + rand() * 0.92,
        width: 0.02 + rand() * 0.05,
        height: 0.08 + rand() * 0.3,
        depth: 0.01 + rand() * 0.02,
        hue: 165 + rand() * 60,
      });
    }
    this.buildings.sort((a, b) => a.x - b.x);
    this.particles = [];
    for (let i = 0; i < 80; i++) {
      this.particles.push({
        x: rand(),
        y: rand(),
        z: 0.2 + rand() * 0.8,
        speed: 0.005 + rand() * 0.02,
        size: 0.5 + rand() * 1.8,
        phase: rand() * Math.PI * 2,
      });
    }
  }

  setHour(hour: number) {
    this.hour = hour;
  }

  start() {
    if (this.raf) return;
    const loop = () => {
      this.t += 0.016;
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cleanupMove?.();
  }

  private render() {
    const { ctx, canvas } = this;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    this.pointerX += (this.targetX - this.pointerX) * 0.05;
    this.pointerY += (this.targetY - this.pointerY) * 0.05;
    const swayX = this.pointerX * 14 + Math.sin(this.t * 0.1) * 3;
    const swayY = this.pointerY * 8;

    const sky = skyAt(this.hour);
    const grad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
    grad.addColorStop(0, sky.sky);
    grad.addColorStop(1, "#02040a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Horizon glow
    const glowGrad = ctx.createRadialGradient(
      w / 2 + swayX * 2,
      h * 0.56,
      10,
      w / 2 + swayX * 2,
      h * 0.56,
      w * 0.7,
    );
    glowGrad.addColorStop(0, sky.glow);
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);

    // Stars / dust
    for (const p of this.particles) {
      const px = p.x * w;
      const py = (p.y * h * 0.5 + this.t * p.speed * 60 * p.z) % (h * 0.5);
      ctx.globalAlpha = 0.25 + 0.3 * Math.sin(this.t * 2 + p.phase) * p.z;
      ctx.fillStyle = "#9fe8ff";
      ctx.fillRect(px, py, p.size * p.z, p.size * p.z);
    }
    ctx.globalAlpha = 1;

    const horizonY = h * 0.56;
    ctx.save();
    ctx.translate(swayX, swayY * 0.4);

    // Skyline
    for (const b of this.buildings) {
      const bx = b.x * w;
      const bw = b.width * w;
      const bh = b.height * h;
      const depth = b.depth * w;
      ctx.strokeStyle = `hsla(${b.hue}, 90%, 70%, 0.5)`;
      ctx.fillStyle = `hsla(${b.hue}, 80%, 40%, 0.12)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx - depth, horizonY - bh + depth * 0.4);
      ctx.lineTo(bx - depth + bw, horizonY - bh + depth * 0.4);
      ctx.lineTo(bx - depth + bw + depth, horizonY - bh + depth * 0.4 + depth);
      ctx.lineTo(bx - depth + bw + depth, horizonY + depth);
      ctx.lineTo(bx - depth, horizonY + depth);
      ctx.lineTo(bx - depth, horizonY - bh + depth * 0.4);
      ctx.moveTo(bx - depth + bw, horizonY - bh + depth * 0.4);
      ctx.lineTo(bx - depth + bw, horizonY + depth);
      ctx.moveTo(bx - depth + bw + depth, horizonY - bh + depth * 0.4 + depth);
      ctx.lineTo(bx - depth + bw + depth, horizonY + depth);
      ctx.fill();
      ctx.stroke();
      // antenna light
      ctx.fillStyle = "rgba(255, 180, 60, 0.9)";
      ctx.fillRect(bx - depth + bw / 2 - 1, horizonY - bh + depth * 0.4 - 4, 2, 4);
      // window grid shimmer
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.t * 1.5 + b.x * 20);
      ctx.fillStyle = "#c8f4ff";
      for (let wy = 0; wy < 4; wy++) {
        for (let wx = 0; wx < 6; wx++) {
          if (Math.sin(b.x * 90 + wx * 3 + wy * 7 + Math.floor(this.t * 2)) > 0.2) {
            ctx.fillRect(
              bx - depth + 4 + wx * ((bw - 6) / 6),
              horizonY - bh + depth * 0.4 + 5 + wy * ((bh * 0.8) / 4),
              2,
              3,
            );
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // Perspective grid floor
    ctx.strokeStyle = "rgba(80, 200, 255, 0.22)";
    ctx.lineWidth = 1;
    const vpX = w / 2 + swayX * 3;
    const offset = (this.t * 40) % 60;
    for (let i = 0; i <= 14; i++) {
      const yy = horizonY + ((i * 60 + offset) * (h - horizonY)) / 900;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(vpX + i * 30, horizonY);
      ctx.lineTo(vpX + i * 160, h);
      ctx.stroke();
    }

    // Scan sweep
    const sweepX = ((this.t * 0.3) % 1.3) * w;
    const sweepGrad = ctx.createLinearGradient(sweepX - 40, 0, sweepX + 40, 0);
    sweepGrad.addColorStop(0, "rgba(80,220,255,0)");
    sweepGrad.addColorStop(0.5, "rgba(80,220,255,0.14)");
    sweepGrad.addColorStop(1, "rgba(80,220,255,0)");
    ctx.fillStyle = sweepGrad;
    ctx.fillRect(sweepX - 40, 0, 80, h);

    ctx.restore();

    // Sun / moon glow dot
    if (sky.sun > 0.5) {
      ctx.fillStyle = "rgba(255, 240, 200, 0.5)";
      ctx.beginPath();
      ctx.arc(w / 2 + swayX * 4, h * 0.2, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}