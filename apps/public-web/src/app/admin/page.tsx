"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import type { Entry } from "@/lib/types";
import { SOURCE_LABELS, EXTERNAL_SITE_IDS } from "@/config/sites";
import styles from "./page.module.css";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return { data: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { data: {} as Record<string, unknown>, textError: text.slice(0, 200) };
  }
}

type Tab = "entries" | "members" | "scrape" | "fees" | "data";

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
        <button
          className={tab === "fees" ? styles.tabActive : styles.tab}
          onClick={() => setTab("fees")}
        >
          参加費
        </button>
        <button
          className={tab === "data" ? styles.tabActive : styles.tab}
          onClick={() => setTab("data")}
        >
          データ
        </button>
      </div>

      {tab === "entries" && <EntriesTab />}
      {tab === "members" && <MembersTab />}
      {tab === "scrape" && <ScrapeTab />}
      {tab === "fees" && <FeesTab />}
      {tab === "data" && <DataTab />}
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
      .then((r) => safeJson(r))
      .then(({ data }) => setEntries((data.entries as Entry[]) ?? []))
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
      .then((r) => safeJson(r))
      .then(({ data }) => setMembers((data.members as Member[]) ?? []))
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
      .then((r) => safeJson(r))
      .then(({ data }) => setHealth((data.results as HealthResult[]) ?? []))
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
      const { data, textError } = await safeJson(res);
      if (!res.ok) throw new Error((data.error as string) || textError || "失敗");
      setHealth((data.results as HealthResult[]) ?? []);
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
      const { data, textError } = await safeJson(res);
      if (!res.ok) throw new Error((data.error as string) || textError || "失敗");
      const results = data.results as Array<{ events?: unknown[] }> | undefined;
      const count = results?.[0]?.events?.length ?? 0;
      setScrapingSites((prev) => ({ ...prev, [siteId]: `${count}件 OK` }));
    } catch (err) {
      setScrapingSites((prev) => ({ ...prev, [siteId]: `エラー` }));
      setError(`${siteId}: ${String(err)}`);
    }
  };

  const handleScrapeAll = async (skipPdf: boolean) => {
    setScraping(true);
    setError(null);
    const sites = Object.keys(SOURCE_LABELS).filter(
      (s) => !EXTERNAL_SITE_IDS.has(s)
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
          const isExternal = EXTERNAL_SITE_IDS.has(siteId);
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

/* ========== 参加費タブ ========== */
interface FeeEvent {
  id: string;
  name: string;
  date: string;
  sourceId: string;
  fee: number | null;
  actualFee: number | null;
  feeSource: string | null;
}

type FeeFilter = "all" | "unset" | "no-actual" | "upcoming";

function FeesTab() {
  const [events, setEvents] = useState<FeeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FeeFilter>("upcoming");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<"fee" | "actualFee">("fee");
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEvents = (f: FeeFilter) => {
    setLoading(true);
    const params = f !== "all" ? `?filter=${f}` : "";
    fetch(`/api/admin/events${params}`)
      .then((r) => safeJson(r))
      .then(({ data }) => setEvents((data.events as FeeEvent[]) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvents(filter);
  }, [filter]);

  const filtered = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.sourceId.toLowerCase().includes(q)
    );
  }, [events, search]);

  const startEdit = (id: string, field: "fee" | "actualFee", current: number | null) => {
    setEditingId(id);
    setEditField(field);
    setEditValue(current != null ? String(current) : "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const val = editValue.trim() ? Number(editValue.replace(/,/g, "")) : null;
      const body: Record<string, number | null> = {};
      body[editField] = val;
      const res = await fetch(`/api/admin/events/${editingId}/fee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      // ローカル更新
      setEvents((prev) =>
        prev.map((e) =>
          e.id === editingId
            ? { ...e, [editField]: val, feeSource: "manual" }
            : e
        )
      );
      cancelEdit();
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") cancelEdit();
  };

  const formatFee = (val: number | null) => {
    if (val == null) return "―";
    return `¥${val.toLocaleString()}`;
  };

  if (loading) return <div className={styles.loading}>読み込み中...</div>;

  return (
    <>
      <div className={styles.filterRow}>
        {([
          { key: "upcoming" as const, label: "今後の大会" },
          { key: "all" as const, label: "すべて" },
          { key: "unset" as const, label: "参加費未設定" },
          { key: "no-actual" as const, label: "実績未入力" },
        ]).map((f) => (
          <button
            key={f.key}
            className={
              filter === f.key ? styles.filterChipActive : styles.filterChip
            }
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          placeholder="大会名 or ソースで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <div className={styles.empty}>該当するイベントはありません</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>大会名</th>
              <th>日付</th>
              <th>参加費</th>
              <th>ソース</th>
              <th>実績費</th>
              <th>差額</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const diff =
                e.fee != null && e.actualFee != null
                  ? e.actualFee - e.fee
                  : null;
              return (
                <tr key={e.id}>
                  <td>
                    <div>{e.name}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>
                      {SOURCE_LABELS[e.sourceId]?.short ?? e.sourceId}
                    </div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{e.date}</td>
                  <td
                    className={styles.editableCell}
                    onClick={() => startEdit(e.id, "fee", e.fee)}
                  >
                    {editingId === e.id && editField === "fee" ? (
                      <input
                        className={styles.inlineInput}
                        type="number"
                        value={editValue}
                        onChange={(ev) => setEditValue(ev.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={saveEdit}
                        disabled={saving}
                        autoFocus
                      />
                    ) : (
                      <span className={e.fee == null ? styles.feeUnset : undefined}>
                        {formatFee(e.fee)}
                      </span>
                    )}
                  </td>
                  <td>
                    {e.feeSource ? (
                      <span
                        className={
                          e.feeSource === "manual"
                            ? styles.sourceManual
                            : styles.sourcePdf
                        }
                      >
                        {e.feeSource}
                      </span>
                    ) : (
                      <span style={{ color: "#cbd5e1" }}>―</span>
                    )}
                  </td>
                  <td
                    className={styles.editableCell}
                    onClick={() => startEdit(e.id, "actualFee", e.actualFee)}
                  >
                    {editingId === e.id && editField === "actualFee" ? (
                      <input
                        className={styles.inlineInput}
                        type="number"
                        value={editValue}
                        onChange={(ev) => setEditValue(ev.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={saveEdit}
                        disabled={saving}
                        autoFocus
                      />
                    ) : (
                      <span className={e.actualFee == null ? styles.feeUnset : undefined}>
                        {formatFee(e.actualFee)}
                      </span>
                    )}
                  </td>
                  <td>
                    {diff != null ? (
                      <span
                        style={{
                          color: diff > 0 ? "#dc2626" : diff < 0 ? "#16a34a" : "#94a3b8",
                          fontWeight: diff !== 0 ? 600 : 400,
                        }}
                      >
                        {diff > 0 ? "+" : ""}
                        {formatFee(diff)}
                      </span>
                    ) : (
                      <span style={{ color: "#cbd5e1" }}>―</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ========== データタブ ========== */
interface DataEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  sourceId: string;
  note: string | null;
}

type DataFilter = "upcoming" | "all";

function DataTab() {
  const [events, setEvents] = useState<DataEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DataFilter>("upcoming");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<keyof Pick<DataEvent, "name" | "date" | "location" | "note">>("name");
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = (f: DataFilter) => {
    setLoading(true);
    const params = f === "upcoming" ? "?filter=upcoming" : "";
    fetch(`/api/admin/events${params}`)
      .then((r) => safeJson(r))
      .then(({ data }) => setEvents((data.events as DataEvent[]) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvents(filter);
  }, [filter]);

  const filtered = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.sourceId.toLowerCase().includes(q) ||
        (e.location ?? "").toLowerCase().includes(q)
    );
  }, [events, search]);

  const startEdit = (id: string, field: typeof editField, current: string | null) => {
    setEditingId(id);
    setEditField(field);
    setEditValue(current ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string | null> = {};
      body[editField] = editValue.trim() || null;
      const res = await fetch(`/api/admin/events/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { data, textError } = await safeJson(res);
      if (!res.ok) throw new Error((data.error as string) || textError || "保存に失敗しました");
      setEvents((prev) =>
        prev.map((e) =>
          e.id === editingId ? { ...e, [editField]: editValue.trim() || null } : e
        )
      );
      cancelEdit();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      const { data, textError } = await safeJson(res);
      if (!res.ok) throw new Error((data.error as string) || textError || "削除に失敗しました");
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(String(err));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") cancelEdit();
  };

  if (loading) return <div className={styles.loading}>読み込み中...</div>;

  return (
    <>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.filterRow}>
        {([
          { key: "upcoming" as const, label: "今後の大会" },
          { key: "all" as const, label: "すべて" },
        ]).map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? styles.filterChipActive : styles.filterChip}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          placeholder="大会名・会場・ソースで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <div className={styles.empty}>該当するイベントはありません</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>大会名</th>
              <th>日付</th>
              <th>会場</th>
              <th>ソース</th>
              <th>備考</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td
                  className={styles.editableCell}
                  onClick={() => startEdit(e.id, "name", e.name)}
                >
                  {editingId === e.id && editField === "name" ? (
                    <input
                      className={styles.inlineInputWide}
                      value={editValue}
                      onChange={(ev) => setEditValue(ev.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={saveEdit}
                      disabled={saving}
                      autoFocus
                    />
                  ) : (
                    e.name
                  )}
                </td>
                <td
                  className={styles.editableCell}
                  onClick={() => startEdit(e.id, "date", e.date)}
                >
                  {editingId === e.id && editField === "date" ? (
                    <input
                      className={styles.inlineInput}
                      type="date"
                      value={editValue}
                      onChange={(ev) => setEditValue(ev.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={saveEdit}
                      disabled={saving}
                      autoFocus
                    />
                  ) : (
                    <span style={{ whiteSpace: "nowrap" }}>{e.date}</span>
                  )}
                </td>
                <td
                  className={styles.editableCell}
                  onClick={() => startEdit(e.id, "location", e.location)}
                >
                  {editingId === e.id && editField === "location" ? (
                    <input
                      className={styles.inlineInputWide}
                      value={editValue}
                      onChange={(ev) => setEditValue(ev.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={saveEdit}
                      disabled={saving}
                      autoFocus
                    />
                  ) : (
                    <span style={{ color: e.location ? undefined : "#cbd5e1" }}>
                      {e.location || "―"}
                    </span>
                  )}
                </td>
                <td>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    {SOURCE_LABELS[e.sourceId]?.short ?? e.sourceId}
                  </span>
                </td>
                <td
                  className={styles.editableCell}
                  onClick={() => startEdit(e.id, "note", e.note)}
                >
                  {editingId === e.id && editField === "note" ? (
                    <input
                      className={styles.inlineInputWide}
                      value={editValue}
                      onChange={(ev) => setEditValue(ev.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={saveEdit}
                      disabled={saving}
                      autoFocus
                    />
                  ) : (
                    <span style={{ color: e.note ? undefined : "#cbd5e1", fontSize: 12 }}>
                      {e.note || "―"}
                    </span>
                  )}
                </td>
                <td>
                  <button
                    className={styles.btnSmallDanger}
                    onClick={() => handleDelete(e.id, e.name)}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
