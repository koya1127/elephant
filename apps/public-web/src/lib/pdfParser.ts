import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import type { Discipline } from "./types";

const PARSE_PROMPT = `この大会要項PDFから以下の情報をJSON形式で抽出してください。

抽出する項目:
- location: 開催場所（会場名）
- disciplines: 種目一覧（配列）
  - name: 種目名（例: "100m", "走幅跳", "4×100mR"）
  - grades: 対象カテゴリの配列（例: ["一般", "高校", "中学"]）
  - note: 備考（あれば）
- maxEntries: 1人あたりのエントリー可能種目数（記載があれば）
- entryDeadline: エントリー締切日（YYYY-MM-DD形式、記載があれば）
- note: その他備考

JSON形式のみで回答してください。マークダウンのコードブロックは不要です。`;

interface PdfParseResult {
  location: string;
  disciplines: Discipline[];
  maxEntries?: number;
  entryDeadline?: string;
  note?: string;
}

/**
 * Claude APIでPDFの内容を解析してJSON化する
 */
export async function parsePdfWithClaude(
  pdfBuffer: Buffer
): Promise<PdfParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });

  const base64Pdf = pdfBuffer.toString("base64");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Pdf,
            },
          },
          {
            type: "text",
            text: PARSE_PROMPT,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  // JSONパース（コードブロックで囲まれている場合も対応）
  let jsonStr = textBlock.text.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let raw;
  try {
    raw = JSON.parse(jsonStr);
  } catch (e) {
    console.error(`[PDF] Failed to parse Claude response: ${jsonStr.slice(0, 200)}`);
    return { location: "", disciplines: [] };
  }
  return normalizePdfResult(raw);
}

/**
 * Haikuの返すデータ形式のブレを吸収する
 * - disciplines がオブジェクト（{male:[], female:[]}）→ フラット配列に変換
 * - maxEntries がオブジェクト → 数値に変換
 * - entryDeadline がオブジェクト → 文字列に変換
 */
function normalizePdfResult(raw: Record<string, unknown>): PdfParseResult {
  return {
    location: typeof raw.location === "string" ? raw.location : "",
    disciplines: normalizeDisciplines(raw.disciplines),
    maxEntries: normalizeMaxEntries(raw.maxEntries),
    entryDeadline: normalizeString(raw.entryDeadline),
    note: normalizeString(raw.note),
  };
}

function normalizeDisciplines(val: unknown): Discipline[] {
  if (Array.isArray(val)) return val;
  if (val && typeof val === "object") {
    // {male: [...], female: [...]} → フラット配列にマージ
    const merged = new Map<string, Discipline>();
    for (const [, arr] of Object.entries(val)) {
      if (!Array.isArray(arr)) continue;
      for (const d of arr) {
        if (!d || typeof d !== "object" || !d.name) continue;
        const existing = merged.get(d.name);
        if (existing) {
          const newGrades = Array.isArray(d.grades) ? d.grades : [];
          existing.grades = [...new Set([...existing.grades, ...newGrades])];
        } else {
          merged.set(d.name, {
            name: String(d.name),
            grades: Array.isArray(d.grades) ? d.grades.map(String) : [],
            ...(d.note ? { note: String(d.note) } : {}),
          });
        }
      }
    }
    return Array.from(merged.values());
  }
  return [];
}

function normalizeMaxEntries(val: unknown): number | undefined {
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && "individual" in val) {
    return typeof (val as Record<string, unknown>).individual === "number"
      ? (val as Record<string, number>).individual
      : undefined;
  }
  return undefined;
}

function normalizeString(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (val === null || val === undefined) return undefined;
  if (typeof val === "object") {
    const first = Object.values(val).find((v) => typeof v === "string");
    return typeof first === "string" ? first : JSON.stringify(val);
  }
  return String(val);
}

const SCHEDULE_PROMPT = `このPDFは陸上競技の大会スケジュール（年間日程表）です。
すべての大会について以下の情報をJSON配列で抽出してください。

各要素:
- name: 大会名（正式名称）
- date: 開催日（YYYY-MM-DD形式）
- dateEnd: 複数日開催の場合の最終日（YYYY-MM-DD形式、1日のみなら省略）
- location: 開催場所・会場名（記載があれば）

注意:
- 「中止」「延期」と記載のある大会は除外してください
- 日付が不明な大会は除外してください
- JSON配列のみで回答してください。マークダウンのコードブロックは不要です。`;

interface ScheduleEvent {
  name: string;
  date: string;
  dateEnd?: string;
  location?: string;
}

/**
 * スケジュールPDFをClaude APIで解析して大会一覧を取得する
 */
export async function parseSchedulePdfWithClaude(
  pdfBuffer: Buffer
): Promise<ScheduleEvent[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });
  const base64Pdf = pdfBuffer.toString("base64");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16384,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Pdf,
            },
          },
          {
            type: "text",
            text: SCHEDULE_PROMPT,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  let jsonStr = textBlock.text.trim();
  // コードブロックで囲まれている場合（閉じがない場合も対応）
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }
  // 先頭の [ を見つけて切り出す（前後の余計なテキストを除去）
  const arrStart = jsonStr.indexOf("[");
  const arrEnd = jsonStr.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd !== -1) {
    jsonStr = jsonStr.substring(arrStart, arrEnd + 1);
  }

  let raw;
  try {
    raw = JSON.parse(jsonStr);
  } catch (e) {
    console.error(`[SchedulePDF] Failed to parse Claude response: ${jsonStr.slice(0, 200)}`);
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new Error("Expected JSON array from Claude API");
  }

  return raw.filter(
    (e: Record<string, unknown>) => e.name && e.date
  ) as ScheduleEvent[];
}

/**
 * Excelファイルをテキストに変換してClaude APIで解析する
 */
export async function parseExcelWithClaude(
  buffer: Buffer
): Promise<PdfParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  // Excelをテキストに変換
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const textParts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) {
      textParts.push(`【シート: ${sheetName}】\n${csv}`);
    }
  }
  const excelText = textParts.join("\n\n");

  if (!excelText.trim()) {
    return { location: "", disciplines: [] };
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `以下は大会要項のExcelファイルの内容です。\n\n${excelText}\n\n${PARSE_PROMPT}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  let jsonStr = textBlock.text.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let raw;
  try {
    raw = JSON.parse(jsonStr);
  } catch (e) {
    console.error(`[Excel] Failed to parse Claude response: ${jsonStr.slice(0, 200)}`);
    return { location: "", disciplines: [] };
  }
  return normalizePdfResult(raw);
}
