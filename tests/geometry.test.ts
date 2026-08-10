import { describe, expect, it } from "vitest";
import { distanceSquared, midpoint, rectangleBounds } from "../src/ink/geometry";

describe("geometry", () => {
  const point = (x: number, y: number, t = 0) => ({ x, y, t });

  it("measures squared point distance without a square root", () => {
    expect(distanceSquared(point(0, 0), point(3, 4))).toBe(25);
  });

  it("computes temporal and spatial midpoints", () => {
    expect(midpoint(point(2, 4, 10), point(6, 10, 30))).toEqual(point(4, 7, 20));
  });

  it("normalizes rectangles dragged in any direction", () => {
    expect(rectangleBounds(point(12, 30), point(2, 5))).toEqual({
      left: 2,
      top: 5,
      width: 10,
      height: 25,
    });
  });
});
