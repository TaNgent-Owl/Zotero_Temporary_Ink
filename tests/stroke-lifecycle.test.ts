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

  it("restarts one shared fade clock after the last stroke is released", () => {
    const model = new InkModel();
    const pen = model.startPen(point(0, 0, 0));
    model.releaseActive(100);
    expect(model.opacityAt(pen, 650, 300, 500)).toBeCloseTo(0.5);

    const rectangle = model.startRectangle(point(2, 2, 650));
    expect(model.opacityAt(pen, 650, 300, 500)).toBe(1);
    expect(model.advance(10_000, 300, 500)).toBe(false);
    expect(model.all).toHaveLength(2);
    expect(model.opacityAt(pen, 10_000, 300, 500)).toBe(1);
    expect(model.animationTiming(10_000, 300, 500)).toEqual({
      fading: false,
      nextFadeAt: null,
    });
    model.releaseActive(10_000);

    expect(model.opacityAt(pen, 10_300, 300, 500)).toBe(1);
    expect(model.opacityAt(rectangle, 10_300, 300, 500)).toBe(1);
    expect(model.opacityAt(pen, 10_550, 300, 500)).toBeCloseTo(0.5);
    expect(model.opacityAt(rectangle, 10_550, 300, 500)).toBeCloseTo(0.5);
    expect(model.advance(10_801, 300, 500)).toBe(false);
    expect(model.all).toHaveLength(0);
  });

  it("cancels only the active stroke and clears everything on demand", () => {
    const model = new InkModel();
    const pen = model.startPen(point(0, 0, 0));
    model.releaseActive(10);
    model.startRectangle(point(1, 1, 20));
    model.cancelActive(30);
    expect(model.all).toHaveLength(1);
    expect(model.opacityAt(pen, 580, 300, 500)).toBeCloseTo(0.5);
    model.clear();
    expect(model.hasVisibleStrokes).toBe(false);
  });
});
