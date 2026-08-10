export interface Point {
  x: number;
  y: number;
  t: number;
}

export interface RectangleBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function distanceSquared(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

export function midpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    t: (a.t + b.t) / 2,
  };
}

export function rectangleBounds(start: Point, end: Point): RectangleBounds {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}
