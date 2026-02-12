import Anthropic from "@anthropic-ai/sdk";
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

  return JSON.parse(jsonStr) as PdfParseResult;
}
