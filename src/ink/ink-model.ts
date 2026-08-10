import { distanceSquared, type Point } from "./geometry";

export type StrokeState = "drawing" | "holding" | "fading";

interface BaseStroke {
  id: number;
  createdAt: number;
  releasedAt?: number;
  state: StrokeState;
}

export interface PenStroke extends BaseStroke {
  type: "pen";
  points: Point[];
}

export interface RectangleStroke extends BaseStroke {
  type: "rectangle";
  start: Point;
  end: Point;
}

export type Stroke = PenStroke | RectangleStroke;

export interface AnimationTiming {
  fading: boolean;
  nextFadeAt: number | null;
}

export class InkModel {
  private strokes: Stroke[] = [];
  private activeStrokeID: number | null = null;
  private nextID = 1;

  get all(): readonly Stroke[] {
    return this.strokes;
  }

  get hasActiveStroke(): boolean {
    return this.activeStrokeID !== null;
  }

  get hasVisibleStrokes(): boolean {
    return this.strokes.length > 0;
  }

  startPen(point: Point): PenStroke {
    this.cancelActive(point.t);
    this.pauseVisibleGroup();
    const stroke: PenStroke = {
      id: this.nextID++,
      type: "pen",
      points: [point],
      createdAt: point.t,
      state: "drawing",
    };
    this.strokes.push(stroke);
    this.activeStrokeID = stroke.id;
    return stroke;
  }

  startRectangle(point: Point): RectangleStroke {
    this.cancelActive(point.t);
    this.pauseVisibleGroup();
    const stroke: RectangleStroke = {
      id: this.nextID++,
      type: "rectangle",
      start: point,
      end: point,
      createdAt: point.t,
      state: "drawing",
    };
    this.strokes.push(stroke);
    this.activeStrokeID = stroke.id;
    return stroke;
  }

  addPenPoint(point: Point, minimumDistance = 1): boolean {
    const stroke = this.active();
    if (!stroke || stroke.type !== "pen") return false;
    const last = stroke.points[stroke.points.length - 1];
    if (distanceSquared(last, point) < minimumDistance * minimumDistance) return false;
    stroke.points.push(point);
    return true;
  }

  updateRectangle(point: Point): boolean {
    const stroke = this.active();
    if (!stroke || stroke.type !== "rectangle") return false;
    stroke.end = point;
    return true;
  }

  releaseActive(now: number): Stroke | null {
    const stroke = this.active();
    if (!stroke) return null;
    this.releaseVisibleGroup(now);
    this.activeStrokeID = null;
    return stroke;
  }

  cancelActive(now: number): void {
    if (this.activeStrokeID === null) return;
    const activeID = this.activeStrokeID;
    this.strokes = this.strokes.filter((stroke) => stroke.id !== activeID);
    this.activeStrokeID = null;
    this.releaseVisibleGroup(now);
  }

  clear(): void {
    this.strokes = [];
    this.activeStrokeID = null;
  }

  opacityAt(stroke: Stroke, now: number, fadeDelay: number, fadeDuration: number): number {
    if (stroke.releasedAt === undefined) return 1;
    const fadeStart = stroke.releasedAt + fadeDelay;
    if (now < fadeStart) return 1;
    if (fadeDuration <= 0) return 0;
    return Math.max(0, 1 - (now - fadeStart) / fadeDuration);
  }

  advance(now: number, fadeDelay: number, fadeDuration: number): boolean {
    for (const stroke of this.strokes) {
      if (stroke.releasedAt !== undefined && now > stroke.releasedAt + fadeDelay) {
        stroke.state = "fading";
      }
    }
    this.strokes = this.strokes.filter(
      (stroke) => this.opacityAt(stroke, now, fadeDelay, fadeDuration) > 0,
    );
    return this.strokes.some((stroke) => stroke.releasedAt !== undefined);
  }

  animationTiming(now: number, fadeDelay: number, fadeDuration: number): AnimationTiming {
    let fading = false;
    let nextFadeAt: number | null = null;
    for (const stroke of this.strokes) {
      if (stroke.releasedAt === undefined) continue;
      const fadeStart = stroke.releasedAt + fadeDelay;
      const fadeEnd = fadeStart + fadeDuration;
      if (now < fadeStart) {
        nextFadeAt = nextFadeAt === null ? fadeStart : Math.min(nextFadeAt, fadeStart);
      }
      else if (now < fadeEnd) {
        fading = true;
      }
    }
    return { fading, nextFadeAt };
  }

  private active(): Stroke | undefined {
    return this.strokes.find((stroke) => stroke.id === this.activeStrokeID);
  }

  private pauseVisibleGroup(): void {
    for (const stroke of this.strokes) {
      delete stroke.releasedAt;
      stroke.state = "holding";
    }
  }

  private releaseVisibleGroup(now: number): void {
    for (const stroke of this.strokes) {
      stroke.releasedAt = now;
      stroke.state = "holding";
    }
  }
}
