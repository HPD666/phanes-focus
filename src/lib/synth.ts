export class SynthScene {
  canvas: HTMLCanvasElement;
  opts: { seed?: number; interactive?: boolean };

  constructor(canvas: HTMLCanvasElement, opts: { seed?: number; interactive?: boolean } = {}) {
    this.canvas = canvas;
    this.opts = opts;
  }

  start() {
    this.render();
  }

  stop() {}

  resize() {
    this.render();
  }

  setHour(_hour: number) {}

  private render() {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const w = this.canvas.width || 640;
    const h = this.canvas.height || 480;
    ctx.fillStyle = "#04070f";
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((this.opts.seed ?? 42) * Math.PI / 180);

    const deskW = w * 0.4;
    const deskH = h * 0.3;

    ctx.fillStyle = "#1a1f2d";
    ctx.fillRect(-deskW / 2, -deskH / 2, deskW, deskH);

    ctx.strokeStyle = "#3b4a6b";
    ctx.lineWidth = 4;
    ctx.strokeRect(-deskW / 2, -deskH / 2, deskW, deskH);

    const legW = 6;
    const legH = 32;
    ctx.fillStyle = "#0e121b";
    [
      [-deskW / 2 + 12, -deskH / 2],
      [deskW / 2 - 12, -deskH / 2],
      [-deskW / 2 + 12, deskH / 2 - legH],
      [deskW / 2 - 12, deskH / 2 - legH],
    ].forEach(([x, y]) => ctx.fillRect(x, y, legW, legH));

    const cupR = 16;
    const cupX = -deskW * 0.15;
    const cupY = -deskH * 0.1;
    ctx.fillStyle = "#0c1119";
    ctx.fillRect(cupX - cupR, cupY - cupR * 1.4, cupR * 2, cupR * 2.4);
    ctx.strokeStyle = "#3b4a6b";
    ctx.strokeRect(cupX - cupR, cupY - cupR * 1.4, cupR * 2, cupR * 2.4);

    ctx.font = "600 18px Space Grotesk, ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#52e0ff";
    ctx.textAlign = "center";
    ctx.fillText("SCANNER TEST OBJECT", 0, deskH * 0.65);

    ctx.restore();
  }
}
