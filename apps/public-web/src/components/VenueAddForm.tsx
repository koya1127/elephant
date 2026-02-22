"use client";

import { useState } from "react";
import type { Venue, VenueType } from "@/lib/types";
import styles from "./VenueAddForm.module.css";

const TYPE_OPTIONS: { value: VenueType; label: string; emoji: string }[] = [
  { value: "stadium", label: "競技場", emoji: "🏟" },
  { value: "practice", label: "練習スポット", emoji: "🏃" },
  { value: "powermax", label: "パワーマックス", emoji: "💪" },
];

export function VenueAddForm({
  lat,
  lng,
  onSubmit,
  onCancel,
}: {
  lat: number;
  lng: number;
  onSubmit: (venue: Venue) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<VenueType>("stadium");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [url, setUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("施設名は必須です");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        type,
        name: name.trim(),
        lat,
        lng,
      };
      if (description.trim()) body.description = description.trim();
      if (address.trim()) body.address = address.trim();
      if (url.trim()) body.url = url.trim();
      if (type === "stadium" && keywords.trim()) {
        body.keywords = keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
      }

      const res = await fetch("/api/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "追加に失敗しました");
      }

      const data = await res.json();
      onSubmit(data.venue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>施設を追加</h3>
        <button className={styles.closeBtn} onClick={onCancel} aria-label="閉じる">
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* 種別 */}
        <div className={styles.typeSelector}>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.typeBtn} ${type === opt.value ? styles.typeBtnActive : ""}`}
              data-type={opt.value}
              onClick={() => setType(opt.value)}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>

        {/* 名前 */}
        <label className={styles.label}>
          施設名 <span className={styles.required}>*</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 円山競技場"
            className={styles.input}
            required
          />
        </label>

        {/* 説明 */}
        <label className={styles.label}>
          説明
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="施設の特徴やメモ"
            className={styles.textarea}
            rows={2}
          />
        </label>

        {/* 住所 */}
        <label className={styles.label}>
          住所
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="北海道..."
            className={styles.input}
          />
        </label>

        {/* URL */}
        <label className={styles.label}>
          Webサイト
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className={styles.input}
          />
        </label>

        {/* キーワード（競技場のみ） */}
        {type === "stadium" && (
          <label className={styles.label}>
            キーワード（大会紐付け用、カンマ区切り）
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="例: 円山"
              className={styles.input}
            />
          </label>
        )}

        {/* 座標表示 */}
        <div className={styles.coords}>
          📍 {lat.toFixed(4)}, {lng.toFixed(4)}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={submitting || !name.trim()}
        >
          {submitting ? "追加中..." : "追加する"}
        </button>
      </form>
    </div>
  );
}
