"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Discipline } from "@/lib/types";
import styles from "./EntryModal.module.css";

interface EntryModalProps {
  eventId: string;
  eventName: string;
  eventDate: string;
  disciplines: Discipline[];
  /** 参加費（設定済みの場合） */
  fee?: number;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "select" | "confirm" | "done";

const SERVICE_FEE = 1500;
const STRIPE_FEE_RATE = 0.036;

export function EntryModal({
  eventId,
  eventName,
  eventDate,
  disciplines,
  fee,
  onClose,
  onSuccess,
}: EntryModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);

  const hasDisciplines = disciplines.length > 0;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const toggleDisc = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const requiresPayment = fee != null && fee > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const discList = hasDisciplines
        ? Array.from(selected)
        : freeText.split(/[,、\s]+/).map((s) => s.trim()).filter(Boolean);

      if (requiresPayment) {
        // Stripe決済フロー
        const res = await fetch("/api/stripe/entry-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            eventName,
            eventDate,
            disciplines: discList,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "エラーが発生しました");
        // Stripe Checkout に遷移
        window.location.href = data.url;
        return;
      }

      // 無料エントリー
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          eventName,
          eventDate,
          disciplines: discList,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "エラーが発生しました");
      setRemaining(data.remaining);
      setStep("done");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => {
    const [, m, day] = d.split("-").map(Number);
    return `${m}月${day}日`;
  };

  const content = (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{eventName}</h2>
          <div className={styles.eventInfo}>{formatDate(eventDate)}</div>
        </div>

        <div className={styles.body}>
          {step === "select" && (
            <>
              <div className={styles.stepLabel}>Step 1 / 3 — 種目選択</div>
              {hasDisciplines ? (
                <div className={styles.discList}>
                  {disciplines.map((d) => {
                    const checked = selected.has(d.name);
                    return (
                      <label
                        key={d.name}
                        className={
                          checked ? styles.discItemSelected : styles.discItem
                        }
                      >
                        <input
                          type="checkbox"
                          className={styles.discCheckbox}
                          checked={checked}
                          onChange={() => toggleDisc(d.name)}
                        />
                        <span className={styles.discName}>{d.name}</span>
                        {d.grades.length > 0 && (
                          <span className={styles.discGrades}>
                            {d.grades.join(" / ")}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.freeInput}>
                  <p className={styles.freeInputNote}>
                    この大会の要項がまだ公開されていないため、種目一覧を表示できません。
                    出場を希望する種目を下に入力してください。
                    要項が公開され次第、スタッフが正式な種目と照合してエントリーを進めます。
                    内容に確認が必要な場合はご連絡いたします。
                  </p>
                  <textarea
                    className={styles.freeInputArea}
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    placeholder="例: 100m, 走幅跳, 4×100mR"
                    rows={3}
                  />
                </div>
              )}
            </>
          )}

          {step === "confirm" && (
            <>
              <div className={styles.stepLabel}>Step 2 / 3 — 確認</div>
              <div className={styles.confirmList}>
                {hasDisciplines
                  ? Array.from(selected).map((name) => (
                      <span key={name} className={styles.confirmTag}>
                        {name}
                      </span>
                    ))
                  : freeText
                      .split(/[,、\s]+/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((name) => (
                        <span key={name} className={styles.confirmTag}>
                          {name}
                        </span>
                      ))}
              </div>
              {requiresPayment && (
                <div className={styles.feeBreakdown}>
                  <div className={styles.feeRow}>
                    <span>参加費</span>
                    <span>¥{fee!.toLocaleString()}</span>
                  </div>
                  <div className={styles.feeRow}>
                    <span>手数料</span>
                    <span>¥{SERVICE_FEE.toLocaleString()}</span>
                  </div>
                  <div className={styles.feeRow}>
                    <span>決済手数料</span>
                    <span>¥{(Math.ceil((fee! + SERVICE_FEE) / (1 - STRIPE_FEE_RATE)) - fee! - SERVICE_FEE).toLocaleString()}</span>
                  </div>
                  <div className={`${styles.feeRow} ${styles.feeTotal}`}>
                    <span>合計</span>
                    <span>¥{Math.ceil((fee! + SERVICE_FEE) / (1 - STRIPE_FEE_RATE)).toLocaleString()}</span>
                  </div>
                </div>
              )}
              <p className={styles.confirmNote}>
                {requiresPayment
                  ? "上記の種目と金額でエントリーします。「支払いへ進む」をクリックすると決済ページへ移動します。"
                  : "上記の種目でエントリーします。よろしいですか？"}
              </p>
              {error && <p className={styles.error}>{error}</p>}
            </>
          )}

          {step === "done" && (
            <>
              <div className={styles.successIcon}>&#x2705;</div>
              <div className={styles.successTitle}>エントリーしました！</div>
              <div className={styles.successRemaining}>
                {remaining !== null && remaining > 0
                  ? `残りエントリー枠: ${remaining}大会`
                  : remaining === 0
                  ? "エントリー枠をすべて使いました"
                  : ""}
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          {step === "select" && (
            <>
              <button className={styles.btnCancel} onClick={onClose}>
                キャンセル
              </button>
              <button
                className={styles.btnPrimary}
                disabled={hasDisciplines ? selected.size === 0 : freeText.trim().length === 0}
                onClick={() => setStep("confirm")}
              >
                確認へ進む
              </button>
            </>
          )}

          {step === "confirm" && (
            <>
              <button
                className={styles.btnCancel}
                onClick={() => setStep("select")}
                disabled={submitting}
              >
                戻る
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? "送信中..."
                  : requiresPayment
                    ? "支払いへ進む"
                    : "エントリーする"}
              </button>
            </>
          )}

          {step === "done" && (
            <button className={styles.btnPrimary} onClick={onClose}>
              閉じる
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
