"use client";

import { useUser, SignInButton } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import {
  PLANS,
  getFullSupportPlans,
  getEntryOnlyPlans,
} from "@/config/plans";
import type { Plan } from "@/config/plans";
import styles from "./page.module.css";

function JoinForm() {
  const { user, isLoaded, isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  const preselectedPlan = searchParams.get("plan") || "";
  const [selectedPlanId, setSelectedPlanId] = useState(
    PLANS.find((p) => p.id === preselectedPlan)?.id || ""
  );

  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    lastNameKana: "",
    firstNameKana: "",
    birthDate: "",
    gender: "",
    phone: "",
    postalCode: "",
    address: "",
    jaafId: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <div className={styles.main}>
        <div className={styles.loginPrompt}>
          <p className={styles.loginPromptText}>
            入会手続きにはログインが必要です
          </p>
          <SignInButton mode="modal">
            <button className={styles.loginBtn}>ログインして入会する</button>
          </SignInButton>
        </div>
      </div>
    );
  }

  // 既にactive会員の場合
  const memberStatus = (user.publicMetadata as Record<string, unknown>)
    ?.memberStatus as string | undefined;
  if (memberStatus === "active") {
    return (
      <div className={styles.main}>
        <div className={styles.loginPrompt}>
          <p className={styles.loginPromptText}>既に入会済みです</p>
          <button
            className={styles.loginBtn}
            onClick={() => router.push("/events")}
          >
            大会一覧を見る
          </button>
        </div>
      </div>
    );
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId || !selectedPlan) {
      setError("プランを選択してください");
      return;
    }
    if (
      !form.lastName ||
      !form.firstName ||
      !form.lastNameKana ||
      !form.firstNameKana ||
      !form.birthDate ||
      !form.gender ||
      !form.phone
    ) {
      setError("必須項目を入力してください");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "エラーが発生しました");
      // Stripe Checkout へリダイレクト
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setSubmitting(false);
    }
  };

  // 入門プラン済みユーザーには入門プランを非表示にする
  const currentPlanId = (user.publicMetadata as Record<string, unknown>)?.planId as string | undefined;
  const usedIntroPlan = currentPlanId === "full-intro" || currentPlanId === "entry-intro";
  const filterIntro = (plans: Plan[]) =>
    usedIntroPlan ? plans.filter((p) => !p.firstYearOnly) : plans;

  const fullPlans = filterIntro(getFullSupportPlans());
  const entryPlans = filterIntro(getEntryOnlyPlans());

  const renderPlanCard = (plan: Plan) => (
    <label
      key={plan.id}
      className={
        selectedPlanId === plan.id ? styles.planCardSelected : styles.planCard
      }
    >
      <input
        type="radio"
        name="plan"
        value={plan.id}
        checked={selectedPlanId === plan.id}
        onChange={() => setSelectedPlanId(plan.id)}
        className={styles.planRadio}
      />
      <div className={styles.planInfo}>
        <div className={styles.planName}>
          {plan.name}
          {plan.firstYearOnly && " (初年度限定)"}
        </div>
        <div className={styles.planMeta}>
          {plan.entryLimit}大会まで
          {plan.includesJaafReg ? " / 陸連登録込み" : " / 陸連登録なし"}
        </div>
      </div>
      <div className={styles.planPrice}>
        &yen;{plan.price.toLocaleString()}
      </div>
    </label>
  );

  return (
    <div className={styles.main}>
      <h1 className={styles.title}>入会手続き</h1>
      <p className={styles.subtitle}>
        会員情報を入力し、プランを選択してください
      </p>

      <form onSubmit={handleSubmit}>
        {/* 個人情報 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>会員情報</h2>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>
                姓<span className={styles.required}>*</span>
              </label>
              <input
                className={styles.input}
                value={form.lastName}
                onChange={set("lastName")}
                placeholder="村松"
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                名<span className={styles.required}>*</span>
              </label>
              <input
                className={styles.input}
                value={form.firstName}
                onChange={set("firstName")}
                placeholder="幸弥"
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                セイ<span className={styles.required}>*</span>
              </label>
              <input
                className={styles.input}
                value={form.lastNameKana}
                onChange={set("lastNameKana")}
                placeholder="ムラマツ"
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                メイ<span className={styles.required}>*</span>
              </label>
              <input
                className={styles.input}
                value={form.firstNameKana}
                onChange={set("firstNameKana")}
                placeholder="コウヤ"
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                生年月日<span className={styles.required}>*</span>
              </label>
              <input
                className={styles.input}
                type="date"
                value={form.birthDate}
                onChange={set("birthDate")}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                性別<span className={styles.required}>*</span>
              </label>
              <select
                className={styles.select}
                value={form.gender}
                onChange={set("gender")}
                required
              >
                <option value="">選択してください</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                電話番号<span className={styles.required}>*</span>
              </label>
              <input
                className={styles.input}
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="090-1234-5678"
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>郵便番号</label>
              <input
                className={styles.input}
                value={form.postalCode}
                onChange={set("postalCode")}
                placeholder="060-0000"
              />
            </div>
            <div className={styles.fieldFull}>
              <label className={styles.label}>住所</label>
              <input
                className={styles.input}
                value={form.address}
                onChange={set("address")}
                placeholder="北海道札幌市..."
              />
            </div>
            <div className={styles.fieldFull}>
              <label className={styles.label}>JAAF ID（お持ちの方）</label>
              <input
                className={styles.input}
                value={form.jaafId}
                onChange={set("jaafId")}
                placeholder="お持ちでない方は空欄でOK"
              />
            </div>
          </div>
        </div>

        {/* プラン選択 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>プラン選択</h2>
          <div className={styles.planGrid}>
            <div className={styles.planGroupLabelFirst}>
              フルサポート（陸連登録 + 大会申込）
            </div>
            {fullPlans.map(renderPlanCard)}

            <div className={styles.planGroupLabel}>
              エントリーのみ（陸連登録はご自身で）
            </div>
            {entryPlans.map(renderPlanCard)}
          </div>
        </div>

        {/* 確認表示 */}
        {selectedPlan && (
          <div className={styles.section}>
            <div
              style={{
                background: "#fff7ed",
                border: "2px solid #f97316",
                borderRadius: 12,
                padding: 16,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 14, color: "#888", marginBottom: 4 }}>
                選択中のプラン
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {selectedPlan.name}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                &yen;{selectedPlan.price.toLocaleString()}
                <span style={{ fontSize: 14, fontWeight: 400, color: "#888" }}>
                  /年
                </span>
              </div>
            </div>
          </div>
        )}

        <div className={styles.submitArea}>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting || !selectedPlanId}
          >
            {submitting ? "処理中..." : "お支払いに進む"}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </form>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  );
}
