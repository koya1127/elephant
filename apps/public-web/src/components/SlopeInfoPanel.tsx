"use client";

import { useState } from "react";
import type { Slope } from "@/lib/types";
import { gradientColor, gradientLabel } from "@/lib/slope-utils";
import { ElevationChart } from "./ElevationChart";
import styles from "./SlopeInfoPanel.module.css";

export function SlopeInfoPanel({
  slope,
  currentUserId,
  isAdmin,
  onClose,
  onDelete,
}: {
  slope: Slope;
  currentUserId: string | null;
  isAdmin: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const canDelete = currentUserId === slope.userId || isAdmin;
  const color = gradientColor(slope.gradient);
  const label = gradientLabel(slope.gradient);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.badge} style={{ backgroundColor: color }}>
          {label} {slope.gradient}%
        </span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">
          ✕
        </button>
      </div>

      <h2 className={styles.name}>{slope.name}</h2>

      {slope.description && (
        <p className={styles.description}>{slope.description}</p>
      )}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{Math.round(slope.distance)}m</span>
          <span className={styles.statLabel}>距離</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{slope.elevationGain}m</span>
          <span className={styles.statLabel}>標高差</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue} style={{ color }}>{slope.gradient}%</span>
          <span className={styles.statLabel}>勾配</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{slope.crossStreets}</span>
          <span className={styles.statLabel}>交差点</span>
        </div>
      </div>

      {/* 標高プロファイルチャート */}
      {slope.elevationProfile && slope.elevationProfile.length >= 2 && (
        <div className={styles.chartSection}>
          <h3 className={styles.chartTitle}>標高プロファイル</h3>
          <ElevationChart profile={slope.elevationProfile} />
        </div>
      )}

      <div className={styles.meta}>
        <span className={styles.source}>
          {slope.source === "auto" ? "自動検出" : "手動登録"}
        </span>
        {slope.osmWayId && (
          <a
            href={`https://www.openstreetmap.org/way/${slope.osmWayId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.osmLink}
          >
            OSM
          </a>
        )}
      </div>

      {canDelete && (
        <div className={styles.deleteArea}>
          {confirming ? (
            <div className={styles.confirmRow}>
              <span className={styles.confirmText}>本当に削除しますか？</span>
              <button
                className={styles.confirmYes}
                onClick={() => onDelete(slope.id)}
              >
                削除する
              </button>
              <button
                className={styles.confirmNo}
                onClick={() => setConfirming(false)}
              >
                キャンセル
              </button>
            </div>
          ) : (
            <button
              className={styles.deleteBtn}
              onClick={() => setConfirming(true)}
            >
              この坂を削除
            </button>
          )}
        </div>
      )}
    </div>
  );
}
