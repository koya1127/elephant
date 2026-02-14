import { NextResponse } from "next/server";
import { hokkaidoConfig } from "@/config/sites";
import * as cheerio from "cheerio";

export async function GET() {
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  try {
    log("Starting debug scrape (require lib)...");

    // 1. Fetch Schedule Page
    const scheduleUrl = hokkaidoConfig.scheduleUrl;
    if (!scheduleUrl) throw new Error("No scheduleUrl");
    log(`Fetching ${scheduleUrl}`);

    const res = await fetch(scheduleUrl);
    const html = await res.text();
    log(`Fetched HTML length: ${html.length}`);

    // 2. Find PDF Link
    const $ = cheerio.load(html);
    let pdfLink = $("a").filter((_, el) => {
      const text = $(el).text();
      const href = $(el).attr("href");
      return text.includes("日程表") && (href?.endsWith(".pdf") || false);
    }).first();

    if (pdfLink.length === 0) {
      log("No '日程表' link found. Trying generic PDF link.");
      pdfLink = $("a[href$='.pdf']").first();
    }

    if (pdfLink.length === 0) {
      throw new Error("No PDF link found");
    }

    const href = pdfLink.attr("href") || "";
    const pdfUrl = href.startsWith("http") ? href : new URL(href, scheduleUrl).toString();
    log(`Found PDF URL: ${pdfUrl}`);

    // 3. Download PDF
    log("Downloading PDF...");
    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) throw new Error(`Failed to download PDF: ${pdfRes.status}`);
    const pdfBuffer = await pdfRes.arrayBuffer();
    log(`Downloaded PDF size: ${pdfBuffer.byteLength}`);

    const buf = Buffer.from(pdfBuffer);
    log(`Is Buffer? ${Buffer.isBuffer(buf)}`);

    // 4. Parse PDF
    log("Resolving pdf-parse (require lib/pdf-parse.js)...");
    // @ts-ignore
    const pdfParseLib = require("pdf-parse/lib/pdf-parse.js");
    log(`Required. Type: ${typeof pdfParseLib}`);

    let parseFunc = pdfParseLib;
    if (typeof parseFunc !== "function" && typeof parseFunc.default === "function") {
      parseFunc = parseFunc.default;
    }
    log(`parseFunc type: ${typeof parseFunc}`);

    if (typeof parseFunc !== "function") {
      log(`pdfParse keys: ${Object.keys(pdfParseLib)}`);
      throw new Error("pdf-parse is not a function");
    }

    log("Parsing PDF with resolved function...");
    const data = await parseFunc(buf);

    log(`Parsed PDF text length: ${data.text.length}`);
    log(`First 100 chars: ${data.text.substring(0, 100)}`);

    // 5. Parse Text
    const events: any[] = [];
    const lines = data.text.split(/\r?\n/);
    let currentMonth = "";

    log(`Total lines: ${lines.length}`);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const monthMatch = trimmed.match(/^(\d{1,2}|[０-９]{1,2})\s*月$/);
      if (monthMatch) {
        const m = monthMatch[1].replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
        currentMonth = m;
        log(`Set currentMonth: ${currentMonth}`);
        continue;
      }
      if (!currentMonth) continue;

      const normalizedLine = trimmed.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
      const dm = normalizedLine.match(/^(\d{1,2})\s*[(（].*?[)）]/);
      if (dm) {
        events.push({ name: trimmed, date: dm[1], month: currentMonth });
      }
    }

    log(`Extracted ${events.length} events`);

    return NextResponse.json({ success: true, logs, events });
  } catch (e: any) {
    log(`Error: ${e.message}`);
    // console.error(e);
    return NextResponse.json({ success: false, logs }, { status: 500 });
  }
}
