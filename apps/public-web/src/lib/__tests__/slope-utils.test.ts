import { describe, it, expect } from "vitest";
import {
  haversine,
  interpolatePoints,
  calcSlopeStats,
  gradientColor,
  gradientLabel,
} from "../slope-utils";

describe("haversine", () => {
  it("同一地点は距離0", () => {
    expect(haversine(43.0, 141.0, 43.0, 141.0)).toBe(0);
  });

  it("札幌駅〜大通公園は約900m", () => {
    const dist = haversine(43.0687, 141.3508, 43.0603, 141.3546);
    expect(dist).toBeGreaterThan(800);
    expect(dist).toBeLessThan(1100);
  });

  it("1度の緯度差は約111km", () => {
    const dist = haversine(43.0, 141.0, 44.0, 141.0);
    expect(dist).toBeGreaterThan(110000);
    expect(dist).toBeLessThan(112000);
  });
});

describe("interpolatePoints", () => {
  it("numPoints=1 で始点と終点の2点を返す", () => {
    const pts = interpolatePoints(43.0, 141.0, 43.1, 141.1, 1);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ lat: 43.0, lng: 141.0 });
    expect(pts[1]).toEqual({ lat: 43.1, lng: 141.1 });
  });

  it("numPoints=2 で中間点が正しい", () => {
    const pts = interpolatePoints(0, 0, 10, 10, 2);
    expect(pts).toHaveLength(3);
    expect(pts[1].lat).toBeCloseTo(5, 5);
    expect(pts[1].lng).toBeCloseTo(5, 5);
  });

  it("numPoints=0 で始点のみ返す", () => {
    const pts = interpolatePoints(43.0, 141.0, 43.1, 141.1, 0);
    expect(pts).toHaveLength(1);
  });
});

describe("calcSlopeStats", () => {
  it("空の配列", () => {
    expect(calcSlopeStats([])).toEqual({ distance: 0, elevationGain: 0, gradient: 0 });
  });

  it("1点のみ", () => {
    expect(calcSlopeStats([{ dist: 0, elev: 100 }])).toEqual({
      distance: 0,
      elevationGain: 0,
      gradient: 0,
    });
  });

  it("100m距離で10m登り = 10%勾配", () => {
    const profile = [
      { dist: 0, elev: 50 },
      { dist: 50, elev: 55 },
      { dist: 100, elev: 60 },
    ];
    const stats = calcSlopeStats(profile);
    expect(stats.distance).toBe(100);
    expect(stats.elevationGain).toBe(10);
    expect(stats.gradient).toBe(10);
  });

  it("下り坂でも正の獲得標高", () => {
    const profile = [
      { dist: 0, elev: 60 },
      { dist: 200, elev: 40 },
    ];
    const stats = calcSlopeStats(profile);
    expect(stats.elevationGain).toBe(20);
    expect(stats.gradient).toBe(10);
  });
});

describe("gradientColor", () => {
  it("5%は緑", () => {
    expect(gradientColor(5)).toBe("#22c55e");
  });
  it("8%は黄", () => {
    expect(gradientColor(8)).toBe("#eab308");
  });
  it("12%は赤", () => {
    expect(gradientColor(12)).toBe("#ef4444");
  });
  it("15%は赤", () => {
    expect(gradientColor(15)).toBe("#ef4444");
  });
});

describe("gradientLabel", () => {
  it("5%は緩坂", () => {
    expect(gradientLabel(5)).toBe("緩坂");
  });
  it("10%は中坂", () => {
    expect(gradientLabel(10)).toBe("中坂");
  });
  it("15%は急坂", () => {
    expect(gradientLabel(15)).toBe("急坂");
  });
});
