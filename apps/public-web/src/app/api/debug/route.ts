import { NextResponse } from "next/server";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(request: Request) {
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") || "https://kushirorikujo.com/r7competitionschedule.html";

  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });

    // Method 1: res.text()
    const text1 = await res.clone().text();

    // Method 2: arrayBuffer -> TextDecoder utf-8
    const buf = await res.arrayBuffer();
    const text2 = new TextDecoder("utf-8").decode(buf);

    // Method 3: Check content-type header
    const contentType = res.headers.get("content-type");

    return NextResponse.json({
      status: res.status,
      contentType,
      method1_text_length: text1.length,
      method1_preview: text1.slice(0, 500),
      method2_decoder_length: text2.length,
      method2_preview: text2.slice(0, 500),
      same: text1 === text2,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
