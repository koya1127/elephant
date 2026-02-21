"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import type { Entry } from "@/lib/types";
import styles from "./page.module.css";

/** sourceId → 表示名マッピング */
const SOURCE_LABELS: Record<string, { short: string; region: string }> = {
  sorachi: { short: "空知", region: "空知地方" },
  kushiro: { short: "釧路", region: "釧路・根室" },
  douo: { short: "道央", region: "道央" },
  sapporo: { short: "札幌", region: "札幌市" },
  hokkaido: { short: "北海道", region: "北海道全域" },
  tokachi: { short: "十勝", region: "十勝地方" },
  chuutairen: { short: "中体連", region: "北海道中学" },
  koutairen: { short: "高体連", region: "北海道高校" },
  gakuren: { short: "学連", region: "北海道大学" },
  masters: { short: "マスターズ", region: "北海道" },
  runnet: { short: "ランネット", region: "ロードレース" },
  tomakomai: { short: "苫小牧", region: "苫小牧市" },
};

type Tab = "entries" | "members" | "scrape";

interface Member {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  memberStatus: string | null;
  planName: string | null;
  entryLimit: number;
  entriesUsed: number;
  createdAt: number;
}

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const [tab, setTab] = useState<Tab>("entries");

  if (!isLoaded) return <div className={styles.loading}>読み込み中...</div>;
  if (!user || (user.publicMetadata as Record<string, unknown>)?.role !== "admin") {
    return <div className={styles.denied}>アクセス権がありません</div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>管理画面</h1>
      <div className={styles.tabs}>
        <button
          className={tab === "entries" ? styles.tabActive : styles.tab}
          onClick={() => setTab("entries")}
        >
          エントリー
        </button>
        <button
          className={tab === "members" ? styles.tabActive : styles.tab}
          onClick={() => setTab("members")}
        >
          会員
        </button>
        <button
          className={tab === "scrape" ? styles.tabActive : styles.tab}
          onClick={() => setTab("scrape")}
        >
          スクレイプ
        </button>
      </div>

      {tab === "entries" && <EntriesTab />}
      {tab === "members" && <MembersTab />}
      {tab === "scrape" && <ScrapeTab />}
    </div>
  );
}

/* ========== エントリータブ ========== */
function EntriesTab() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/entries")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.eventName.toLowerCase().includes(q) ||
        e.userId.toLowerCase().includes(q)
    );
  }, [entries, search]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [filtered]
  );

  if (loading) return <div className={styles.loading}>読み込み中...</div>;

  return (
    <>
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          placeholder="大会名 or ユーザーIDで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {sorted.length === 0 ? (
        <div className={styles.empty}>エントリーはありません</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>大会名</th>
              <th>日付</th>
              <th>ユーザーID</th>
              <th>種目</th>
              <th>申込日</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.id}>
                <td>{e.eventName}</td>
                <td>{e.eventDate}</td>
                <td style={{ fontSize: 11, fontFamily: "monospace" }}>
                  {e.userId.slice(0, 12)}...
                </td>
                <td>{e.disciplines.join(", ")}</td>
                <td>{new Date(e.createdAt).toLocaleDateString("ja-JP")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ========== 会員タブ ========== */
function MembersTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/members")
      .then((r) => r.json())
      .then((d) => setMembers(d.members ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = members;
    if (statusFilter) {
      if (statusFilter === "none") {
        list = list.filter((m) => !m.memberStatus);
      } else {
        list = list.filter((m) => m.memberStatus === statusFilter);
      }
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          (m.firstName ?? "").toLowerCase().includes(q) ||
          (m.lastName ?? "").toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [members, statusFilter, search]);

  if (loading) return <div className={styles.loading}>読み込み中...</div>;

  return (
    <>
      <div className={styles.filterRow}>
        {[
          { key: null, label: "すべて" },
          { key: "active", label: "Active" },
          { key: "pending", label: "Pending" },
          { key: "none", label: "未入会" },
        ].map((f) => (
          <button
            key={f.key ?? "all"}
            className={
              statusFilter === f.key ? styles.filterChipActive : styles.filterChip
            }
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          placeholder="名前 or メールで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <div className={styles.empty}>該当する会員はいません</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>名前</th>
              <th>メール</th>
              <th>プラン</th>
              <th>エントリー</th>
              <th>ステータス</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.lastName ?? ""} {m.firstName ?? ""}
                </td>
                <td>{m.email}</td>
                <td>{m.planName ?? "―"}</td>
                <td>
                  {m.entriesUsed} / {m.entryLimit}
                </td>
                <td>
                  {m.memberStatus === "active" ? (
                    <span className={styles.statusActive}>Active</span>
                  ) : m.memberStatus === "pending" ? (
                    <span className={styles.statusPending}>Pending</span>
                  ) : (
                    <span className={styles.statusNone}>未入会</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ========== スクレイプタブ ========== */
interface YearHealth {
  year: number;
  eventCount: number;
  pdfTotal: number;
  pdfOk: number;
  pdfErrors: string[];
}

interface HealthResult {
  siteId: string;
  siteName: string;
  checkedAt: string;
  years: YearHealth[];
  error?: string;
}

function ScrapeTab() {
  const [scraping, setScraping] = useState(false);
  const [scrapingSites, setScrapingSites] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResult[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch("/api/admin/health")
      .then((r) => r.json())
      .then((d) => setHealth(d.results ?? []))
      .catch(() => {})
      .finally(() => setHealthLoading(false));
  }, []);

  const runHealthCheck = async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/health", {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗");
      setHealth(data.results ?? []);
    } catch (err) {
      setError(`健康診断エラー: ${String(err)}`);
    } finally {
      setChecking(false);
    }
  };

  const handleScrapeSite = async (siteId: string, skipPdf: boolean) => {
    const label = skipPdf ? "HTML取得中" : "PDF解析中";
    setScrapingSites((prev) => ({ ...prev, [siteId]: label }));
    setError(null);
    try {
      const params = new URLSearchParams({ siteId });
      if (skipPdf) params.set("skipPdf", "true");
      const res = await fetch(`/api/scrape?${params}`, {
        method: "POST",
        signal: AbortSignal.timeout(300_000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "失敗");
      const count = data.results?.[0]?.events?.length ?? 0;
      setScrapingSites((prev) => ({ ...prev, [siteId]: `${count}件 OK` }));
    } catch (err) {
      setScrapingSites((prev) => ({ ...prev, [siteId]: `エラー` }));
      setError(`${siteId}: ${String(err)}`);
    }
  };

  const handleScrapeAll = async (skipPdf: boolean) => {
    setScraping(true);
    setError(null);
    const SKIP_SITES = ["douo", "koutairen"];
    const sites = Object.keys(SOURCE_LABELS).filter(
      (s) => !SKIP_SITES.includes(s)
    );
    for (const siteId of sites) {
      await handleScrapeSite(siteId, skipPdf);
    }
    setScraping(false);
  };

  return (
    <div className={styles.scrapePanel}>
      {error && <div className={styles.error}>{error}</div>}

      {/* 健康診断 */}
      <div className={styles.healthSection}>
        <div className={styles.healthHeader}>
          <h3 className={styles.healthTitle}>サイト取得状況</h3>
          <button
            onClick={runHealthCheck}
            disabled={checking}
            className={styles.btnSmall}
          >
            {checking && <span className={styles.spinner} />}
            診断実行
          </button>
        </div>
        {healthLoading ? (
          <div className={styles.loading}>読み込み中...</div>
        ) : health.length === 0 ? (
          <div className={styles.empty}>まだ診断結果がありません</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>サイト</th>
                <th>年</th>
                <th>件数</th>
                <th>PDF</th>
                <th>最終チェック</th>
              </tr>
            </thead>
            <tbody>
              {health.map((h) =>
                h.error || !h.years ? (
                  <tr key={h.siteId}>
                    <td>{h.siteName}</td>
                    <td colSpan={3}>
                      <span className={styles.statusNone} title={h.error}>エラー</span>
                    </td>
                    <td style={{ fontSize: 11, color: "#94a3b8" }}>
                      {new Date(h.checkedAt).toLocaleString("ja-JP")}
                    </td>
                  </tr>
                ) : (
                  h.years.map((y, i) => (
                    <tr key={`${h.siteId}-${y.year}`}>
                      {i === 0 && (
                        <td rowSpan={h.years.length} style={{ verticalAlign: "middle" }}>
                          {h.siteName}
                        </td>
                      )}
                      <td>{y.year}</td>
                      <td>
                        {y.eventCount > 0 ? (
                          <span className={styles.statusActive}>{y.eventCount}件</span>
                        ) : (
                          <span className={styles.statusNone}>0件</span>
                        )}
                      </td>
                      <td>
                        {y.pdfTotal > 0 ? (
                          <span
                            className={
                              y.pdfOk === y.pdfTotal
                                ? styles.statusActive
                                : y.pdfOk > 0
                                  ? styles.statusPending
                                  : styles.statusNone
                            }
                            title={y.pdfErrors.length > 0 ? y.pdfErrors.join("\n") : undefined}
                          >
                            {y.pdfOk}/{y.pdfTotal}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 11 }}>―</span>
                        )}
                      </td>
                      {i === 0 && (
                        <td
                          rowSpan={h.years.length}
                          style={{ fontSize: 11, color: "#94a3b8", verticalAlign: "middle" }}
                        >
                          {new Date(h.checkedAt).toLocaleString("ja-JP")}
                        </td>
                      )}
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* サイト別スクレイプ */}
      <div className={styles.siteGrid}>
        {Object.entries(SOURCE_LABELS).map(([siteId, info]) => {
          const isExternal = siteId === "douo" || siteId === "koutairen";
          const status = scrapingSites[siteId];
          const isBusy = status === "HTML取得中" || status === "PDF解析中";
          return (
            <div key={siteId} className={styles.siteRow}>
              <div className={styles.siteName}>
                <span className={styles.siteShort}>{info.short}</span>
                <span className={styles.siteRegion}>{info.region}</span>
              </div>
              {isExternal ? (
                <span className={styles.siteExternal}>専用スクリプト</span>
              ) : (
                <div className={styles.siteActions}>
                  <button
                    onClick={() => handleScrapeSite(siteId, true)}
                    disabled={isBusy || scraping}
                    className={styles.btnSmall}
                  >
                    {isBusy && status === "HTML取得中" ? (
                      <span className={styles.spinner} />
                    ) : null}
                    HTML
                  </button>
                  <button
                    onClick={() => handleScrapeSite(siteId, false)}
                    disabled={isBusy || scraping}
                    className={styles.btnSmallPrimary}
                  >
                    {isBusy && status === "PDF解析中" ? (
                      <span className={styles.spinner} />
                    ) : null}
                    PDF
                  </button>
                </div>
              )}
              {status && (
                <span
                  className={
                    status.includes("エラー")
                      ? styles.siteStatusError
                      : status.includes("OK")
                        ? styles.siteStatusOk
                        : styles.siteStatusBusy
                  }
                >
                  {status}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.toolbar}>
        <button
          onClick={() => handleScrapeAll(true)}
          disabled={scraping}
          className={styles.btnLight}
        >
          {scraping && <span className={styles.spinner} />}
          一括HTML取得
        </button>
        <button
          onClick={() => handleScrapeAll(false)}
          disabled={scraping}
          className={styles.btnPrimary}
        >
          {scraping && <span className={styles.spinner} />}
          一括PDF解析
        </button>
        {scraping && (
          <button onClick={() => setScraping(false)} className={styles.btnLight}>
            中断
          </button>
        )}
      </div>
    </div>
  );
}
