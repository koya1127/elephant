import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { venues } from "@/lib/db/schema";

export const runtime = "nodejs";

/** GET /api/venues — 全件取得（認証不要） */
export async function GET() {
  const rows = await db.select().from(venues);
  return NextResponse.json({ venues: rows });
}

/** POST /api/venues — 新規追加（要ログイン） */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = await req.json();
  const { type, name, description, address, lat, lng, keywords, url } = body as {
    type: string;
    name: string;
    description?: string;
    address?: string;
    lat: number;
    lng: number;
    keywords?: string[];
    url?: string;
  };

  if (!type || !name || lat == null || lng == null) {
    return NextResponse.json(
      { error: "type, name, lat, lng は必須です" },
      { status: 400 }
    );
  }

  if (!["stadium", "practice", "powermax"].includes(type)) {
    return NextResponse.json(
      { error: "type は stadium, practice, powermax のいずれかです" },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID().slice(0, 12);

  const [venue] = await db
    .insert(venues)
    .values({
      id,
      type,
      name,
      description: description || null,
      address: address || null,
      lat,
      lng,
      keywords: keywords || [],
      url: url || null,
      userId,
    })
    .returning();

  return NextResponse.json({ venue }, { status: 201 });
}
