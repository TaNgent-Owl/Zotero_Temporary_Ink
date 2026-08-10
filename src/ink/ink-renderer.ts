import type { SettingsProvider } from "../config/preferences";
import type { InkSettings } from "../config/constants";
import { midpoint, rectangleBounds } from "./geometry";
import { InkModel, type PenStroke, type RectangleStroke } from "./ink-model";

export class InkRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly context2D: CanvasRenderingContext2D;
  private frameID: number | null = null;
  private wakeTimerID: number | null = null;
  private disposed = false;

  constructor(
    private readonly window: Window & typeof globalThis,
    private readonly viewerElement: HTMLElement,
    private readonly model: InkModel,
    private readonly settingsProvider: SettingsProvider,
  ) {
    this.canvas = window.document.createElement("canvas");
    this.canvas.dataset.temporaryInk = "canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, {
      position: "fixed",
      pointerEvents: "none",
      zIndex: "2147483000",
      margin: "0",
    });
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");
    this.context2D = context;
  }

  mount(host: HTMLElement): void {
    host.querySelector('[data-temporary-ink="canvas"]')?.remove();
    host.append(this.canvas);
    this.resize();
  }

  resize(): void {
    if (this.disposed) return;
    const rect = this.viewerElement.getBoundingClientRect();
    const dpr = Math.max(1, this.window.devicePixelRatio || 1);
    this.canvas.style.left = `${rect.left}px`;
    this.canvas.style.top = `${rect.top}px`;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.context2D.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.model.clear();
    this.draw(this.window.performance.now());
  }

  pointFromClient(clientX: number, clientY: number, t: number): { x: number; y: number; t: number } {
    const rect = this.viewerElement.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top, t };
  }

  invalidate(): void {
    if (this.disposed) return;
    if (this.wakeTimerID !== null) {
      this.window.clearTimeout(this.wakeTimerID);
      this.wakeTimerID = null;
    }
    if (this.frameID !== null) return;
    this.frameID = this.window.requestAnimationFrame((now) => this.onFrame(now));
  }

  clear(): void {
    this.model.clear();
    if (this.frameID !== null) {
      this.window.cancelAnimationFrame(this.frameID);
      this.frameID = null;
    }
    if (this.wakeTimerID !== null) {
      this.window.clearTimeout(this.wakeTimerID);
      this.wakeTimerID = null;
    }
    this.draw(this.window.performance.now());
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frameID !== null) this.window.cancelAnimationFrame(this.frameID);
    if (this.wakeTimerID !== null) this.window.clearTimeout(this.wakeTimerID);
    this.frameID = null;
    this.wakeTimerID = null;
    this.model.clear();
    this.canvas.remove();
  }

  private onFrame(now: number): void {
    this.frameID = null;
    const settings = this.settingsProvider();
    this.model.advance(now, settings.fadeDelay, settings.fadeDuration);
    this.draw(now);
    const timing = this.model.animationTiming(now, settings.fadeDelay, settings.fadeDuration);
    if (timing.fading) {
      this.invalidate();
    }
    else if (timing.nextFadeAt !== null) {
      this.wakeTimerID = this.window.setTimeout(() => {
        this.wakeTimerID = null;
        this.invalidate();
      }, Math.max(0, timing.nextFadeAt - now));
    }
  }

  private draw(now: number): void {
    const dpr = Math.max(1, this.window.devicePixelRatio || 1);
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    this.context2D.clearRect(0, 0, width, height);
    const settings = this.settingsProvider();
    for (const stroke of this.model.all) {
      const lifeOpacity = this.model.opacityAt(stroke, now, settings.fadeDelay, settings.fadeDuration);
      if (stroke.type === "pen") this.drawPen(stroke, lifeOpacity * settings.penOpacity, settings);
      else this.drawRectangle(stroke, lifeOpacity * settings.penOpacity, settings);
    }
  }

  private drawPen(stroke: PenStroke, opacity: number, settings: InkSettings): void {
    const points = stroke.points;
    if (!points.length) return;
    const ctx = this.context2D;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = settings.penColor;
    ctx.fillStyle = settings.penColor;
    ctx.lineWidth = settings.penWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, settings.penWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    else {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length - 1; index++) {
        const mid = midpoint(points[index], points[index + 1]);
        ctx.quadraticCurveTo(points[index].x, points[index].y, mid.x, mid.y);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawRectangle(stroke: RectangleStroke, opacity: number, settings: InkSettings): void {
    const bounds = rectangleBounds(stroke.start, stroke.end);
    const ctx = this.context2D;
    ctx.save();
    ctx.strokeStyle = settings.penColor;
    ctx.fillStyle = settings.penColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = opacity * 0.07;
    ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
    ctx.globalAlpha = opacity;
    ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
    ctx.restore();
  }
}
