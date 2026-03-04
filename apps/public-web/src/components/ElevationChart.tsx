"use client";

import type { ElevationPoint } from "@/lib/types";
import styles from "./ElevationChart.module.css";

const CHART_WIDTH = 300;
const CHART_HEIGHT = 120;
const PADDING = { top: 10, right: 10, bottom: 25, left: 40 };

export function ElevationChart({ profile }: { profile: ElevationPoint[] }) {
  if (profile.length < 2) return null;

  const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const maxDist = profile[profile.length - 1].dist;
  const elevs = profile.map((p) => p.elev);
  const minElev = Math.min(...elevs);
  const maxElev = Math.max(...elevs);
  const elevRange = maxElev - minElev || 1;

  const toX = (dist: number) => PADDING.left + (dist / maxDist) * innerW;
  const toY = (elev: number) =>
    PADDING.top + innerH - ((elev - minElev) / elevRange) * innerH;

  // Area path
  const linePoints = profile.map((p) => `${toX(p.dist)},${toY(p.elev)}`).join(" ");
  const areaPath = `M${toX(0)},${toY(profile[0].elev)} L${linePoints} L${toX(maxDist)},${PADDING.top + innerH} L${toX(0)},${PADDING.top + innerH} Z`;

  // Y-axis labels (3 ticks)
  const yTicks = [minElev, minElev + elevRange / 2, maxElev].map((v) =>
    Math.round(v)
  );

  // X-axis labels
  const xTicks = [0, Math.round(maxDist / 2), Math.round(maxDist)];

  return (
    <div className={styles.container}>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className={styles.svg}
      >
        {/* Grid lines */}
        {yTicks.map((v) => (
          <line
            key={`gy-${v}`}
            x1={PADDING.left}
            y1={toY(v)}
            x2={CHART_WIDTH - PADDING.right}
            y2={toY(v)}
            className={styles.gridLine}
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} className={styles.area} />

        {/* Line */}
        <polyline
          points={linePoints}
          className={styles.line}
          fill="none"
        />

        {/* Y-axis labels */}
        {yTicks.map((v) => (
          <text
            key={`y-${v}`}
            x={PADDING.left - 4}
            y={toY(v) + 3}
            className={styles.axisLabel}
            textAnchor="end"
          >
            {v}m
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((v) => (
          <text
            key={`x-${v}`}
            x={toX(v)}
            y={CHART_HEIGHT - 4}
            className={styles.axisLabel}
            textAnchor="middle"
          >
            {v}m
          </text>
        ))}
      </svg>
    </div>
  );
}
