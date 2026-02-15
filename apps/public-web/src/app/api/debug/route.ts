import { NextResponse } from "next/server";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(request: Request) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const urls = [
    "https://www.douo-tandf.com/%E7%AB%B6%E6%8A%80%E4%BC%9A%E6%83%85%E5%A0%B1/",
    "https://www.doukoutairen-rikujyou.com/%E5%A4%A7%E4%BC%9A%E6%97%A5%E7%A8%8B/",
  ];

  const results = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      const text = await res.text();
      results.push({
        url,
        status: res.status,
        bodyLength: text.length,
        preview: text.slice(0, 300),
      });
    } catch (e) {
      results.push({ url, error: String(e) });
    }
  }

  return NextResponse.json(results);
}
