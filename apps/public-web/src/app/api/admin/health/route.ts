import { NextResponse } from "next/server";
import { scrapeEvents } from "@/lib/scraper";
import { siteConfigs } from "@/config/sites";
import { readHealth, writeHealth } from "@/lib/health-storage";
import { checkAdmin } from "@/lib/admin";
import type { SiteConfig, SiteHealthResult, YearHealth, ScrapedEventRaw } from "@/lib/types";

export const maxDuration = 300;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** GET: 最新の健康診断結果を返す */
export async function GET() {
  const auth = await checkAdmin();
  if (!auth.ok) return auth.response;
  const results = await readHealth();
  return NextResponse.json({ results });
}

/** POST: 全サイトの健康診断を実行（LLM不使用） */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuth) {
    const auth = await checkAdmin();
    if (!auth.ok) return auth.response;
  }

  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;

  // 全サイトを並列チェック（サイトごとに60秒タイムアウト）
  const SITE_TIMEOUT = 60_000;

  const settled = await Promise.allSettled(
    siteConfigs.map(async (config): Promise<SiteHealthResult> => {
      const result: SiteHealthResult = {
        siteId: config.id,
        siteName: config.name,
        checkedAt: new Date().toISOString(),
        years: [],
      };

      const siteTask = async () => {
        const hasYearInUrl =
          config.url.includes(String(currentYear)) ||
          config.url.includes(String(prevYear));

        if (hasYearInUrl) {
          // 年依存URL: 両年を並列チェック
          const yearResults = await Promise.allSettled(
            [prevYear, currentYear].map(async (yr) => {
              const reiwa = yr - 2018;
              const prevReiwa = prevYear - 2018;
              const curReiwa = currentYear - 2018;
              const url = config.url
                .replaceAll(String(currentYear), String(yr))
                .replaceAll(String(prevYear), String(yr))
                .replace(`r${curReiwa}`, `r${reiwa}`)
                .replace(`r${prevReiwa}`, `r${reiwa}`);
              const baseUrl = config.baseUrl
                .replaceAll(String(currentYear), String(yr))
                .replaceAll(String(prevYear), String(yr));
              const yearConfig: SiteConfig = { ...config, url, baseUrl, effectiveYear: yr };
              return { yr, health: await checkSiteYear(yearConfig, yr) };
            })
          );
          for (const r of yearResults) {
            if (r.status === "fulfilled") result.years.push(r.value.health);
          }
        } else {
          // 固定URL: 一括取得してイベント日付から年を振り分け
          const events = await scrapeEvents({ ...config, effectiveYear: currentYear });
          const byYear = new Map<number, ScrapedEventRaw[]>();
          for (const e of events) {
            const dateYear = parseInt(e.dateText.substring(0, 4), 10);
            const yr = isNaN(dateYear) ? currentYear : dateYear;
            if (!byYear.has(yr)) byYear.set(yr, []);
            byYear.get(yr)!.push(e);
          }
          for (const yr of [prevYear, currentYear]) {
            if (!byYear.has(yr)) byYear.set(yr, []);
          }
          for (const [yr, evts] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
            const pdfUrls = [...new Set(evts.map((e) => e.pdfUrl).filter((u): u is string => !!u))];
            const pdfCheck = await checkPdfs(pdfUrls);
            result.years.push({ year: yr, eventCount: evts.length, pdfTotal: pdfUrls.length, pdfOk: pdfCheck.ok, pdfErrors: pdfCheck.errors });
          }
        }
      };

      try {
        await Promise.race([
          siteTask(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("site timeout")), SITE_TIMEOUT)
          ),
        ]);
      } catch (e) {
        result.error = String(e).slice(0, 200);
      }

      return result;
    })
  );

  const results: SiteHealthResult[] = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { siteId: siteConfigs[i].id, siteName: siteConfigs[i].name, checkedAt: new Date().toISOString(), years: [], error: String(r.reason).slice(0, 200) }
  );

  await writeHealth(results);

  const ok = results.filter((r) => r.years.some((y) => y.eventCount > 0)).length;
  const ng = results.filter((r) => r.years.every((y) => y.eventCount === 0) && !r.error).length;
  const err = results.filter((r) => !!r.error).length;

  return NextResponse.json({
    success: true,
    message: `${ok} sites OK, ${ng} empty, ${err} errors`,
    results,
  });
}

/** 特定年のサイトをチェック */
async function checkSiteYear(config: SiteConfig, year: number): Promise<YearHealth> {
  const yh: YearHealth = { year, eventCount: 0, pdfTotal: 0, pdfOk: 0, pdfErrors: [] };

  try {
    const events = await scrapeEvents(config, true);
    yh.eventCount = events.length;

    const pdfUrls = [...new Set(events.map((e) => e.pdfUrl).filter((u): u is string => !!u))];
    yh.pdfTotal = pdfUrls.length;
    const pdfCheck = await checkPdfs(pdfUrls);
    yh.pdfOk = pdfCheck.ok;
    yh.pdfErrors = pdfCheck.errors;
  } catch {
    // 404等 → eventCount=0のまま
  }

  return yh;
}

/** PDF URLリストのHEADリクエストチェック */
async function checkPdfs(urls: string[]): Promise<{ ok: number; errors: string[] }> {
  let ok = 0;
  const errors: string[] = [];
  const BATCH = 10;

  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const checks = await Promise.allSettled(
      batch.map(async (url) => {
        const res = await fetch(url, {
          method: "HEAD",
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(10_000),
        });
        return { url, status: res.status };
      })
    );
    for (const check of checks) {
      if (check.status === "fulfilled" && check.value.status === 200) {
        ok++;
      } else {
        const failUrl =
          check.status === "fulfilled"
            ? `${check.value.url} (${check.value.status})`
            : `(timeout/error)`;
        if (errors.length < 5) errors.push(failUrl);
      }
    }
  }

  return { ok, errors };
}
