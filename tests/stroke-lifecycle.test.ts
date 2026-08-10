import { describe, expect, it } from "vitest";
import { InkModel } from "../src/ink/ink-model";

describe("InkModel", () => {
  const point = (x: number, y: number, t: number) => ({ x, y, t });

  it("samples pen points at a minimum distance", () => {
    const model = new InkModel();
    model.startPen(point(0, 0, 0));
    expect(model.addPenPoint(point(0.5, 0.5, 1))).toBe(false);
    expect(model.addPenPoint(point(1, 1, 2))).toBe(true);
    expect(model.all[0].type === "pen" && model.all[0].points).toHaveLength(2);
  });

  it("holds, fades, and deletes released strokes", () => {
    const model = new InkModel();
    const stroke = model.startPen(point(0, 0, 0));
    model.releaseActive(100);
    expect(model.opacityAt(stroke, 400, 300, 500)).toBe(1);
    expect(model.opacityAt(stroke, 650, 300, 500)).toBeCloseTo(0.5);
    expect(model.advance(899, 300, 500)).toBe(true);
    expect(model.advance(901, 300, 500)).toBe(false);
    expect(model.all).toHaveLength(0);
  });

  it("deletes immediately at fade start when duration is zero", () => {
    const model = new InkModel();
    model.startPen(point(0, 0, 0));
    model.releaseActive(100);
    expect(model.advance(400, 300, 0)).toBe(false);
    expect(model.all).toHaveLength(0);
  });

  it("requests one wake-up during hold and animation frames only during fade", () => {
    const model = new InkModel();
    model.startPen(point(0, 0, 0));
    model.releaseActive(100);
    expect(model.animationTiming(200, 300, 500)).toEqual({
      fading: false,
      nextFadeAt: 400,
    });
    expect(model.animationTiming(450, 300, 500)).toEqual({
      fading: true,
      nextFadeAt: null,
    });
    model.advance(901, 300, 500);
    expect(model.animationTiming(901, 300, 500)).toEqual({
      fading: false,
      nextFadeAt: null,
    });
  });

  it("keeps overlapping strokes on independent clocks", () => {
    const model = new InkModel();
    model.startPen(point(0, 0, 0));
    model.releaseActive(100);
    model.startRectangle(point(2, 2, 200));
    model.releaseActive(300);
    model.advance(950, 300, 500);
    expect(model.all).toHaveLength(1);
    expect(model.all[0].type).toBe("rectangle");
  });

  it("cancels only the active stroke and clears everything on demand", () => {
    const model = new InkModel();
    model.startPen(point(0, 0, 0));
    model.releaseActive(10);
    model.startRectangle(point(1, 1, 20));
    model.cancelActive();
    expect(model.all).toHaveLength(1);
    model.clear();
    expect(model.hasVisibleStrokes).toBe(false);
  });
});
