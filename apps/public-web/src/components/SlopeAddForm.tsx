"use client";

import { useState } from "react";
import type { Slope } from "@/lib/types";
import styles from "./SlopeAddForm.module.css";

export function SlopeAddForm({
  startCoords,
  endCoords,
  onSubmit,
  onCancel,
}: {
  startCoords: { lat: number; lng: number };
  endCoords: { lat: number; lng: number };
  onSubmit: (slope: Slope) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("坂の名前は必須です");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/slopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          lat: startCoords.lat,
          lng: startCoords.lng,
          latEnd: endCoords.lat,
          lngEnd: endCoords.lng,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "追加に失敗しました");
      }

      const data = await res.json();
      onSubmit(data.slope);
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>坂を追加</h3>
        <button className={styles.closeBtn} onClick={onCancel} aria-label="閉じる">
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.label}>
          坂の名前 <span className={styles.required}>*</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 円山坂ダッシュ"
            className={styles.input}
            required
          />
        </label>

        <label className={styles.label}>
          説明
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="路面状態や注意点など"
            className={styles.textarea}
            rows={2}
          />
        </label>

        <div className={styles.coords}>
          <div className={styles.coordRow}>
            <span className={styles.coordLabel}>Start</span>
            {startCoords.lat.toFixed(4)}, {startCoords.lng.toFixed(4)}
          </div>
          <div className={styles.coordRow}>
            <span className={styles.coordLabel}>Goal</span>
            {endCoords.lat.toFixed(4)}, {endCoords.lng.toFixed(4)}
          </div>
        </div>

        <p className={styles.hint}>
          標高・勾配・距離は自動計算されます
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={submitting || !name.trim()}
        >
          {submitting ? "計算中..." : "追加する"}
        </button>
      </form>
    </div>
  );
}
