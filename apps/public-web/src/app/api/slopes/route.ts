import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { slopes } from "@/lib/db/schema";
import {
  haversine,
  interpolatePoints,
  fetchElevationProfile,
  calcSlopeStats,
} from "@/lib/slope-utils";

export const runtime = "nodejs";

/** GET /api/slopes — 全件取得（認証不要） */
export async function GET() {
  const rows = await db.select().from(slopes);
  return NextResponse.json({ slopes: rows });
}

/** POST /api/slopes — 手動追加（要ログイン、GSI自動計算） */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, lat, lng, latEnd, lngEnd } = body as {
    name: string;
    description?: string;
    lat: number;
    lng: number;
    latEnd: number;
    lngEnd: number;
  };

  if (!name || lat == null || lng == null || latEnd == null || lngEnd == null) {
    return NextResponse.json(
      { error: "name, lat, lng, latEnd, lngEnd は必須です" },
      { status: 400 }
    );
  }

  // 直線距離をチェック
  const roughDist = haversine(lat, lng, latEnd, lngEnd);
  if (roughDist > 2000) {
    return NextResponse.json(
      { error: "距離が長すぎます（最大2km）" },
      { status: 400 }
    );
  }

  // 標高プロファイルを自動取得（15分割）
  const numPoints = Math.max(10, Math.min(20, Math.round(roughDist / 20)));
  const points = interpolatePoints(lat, lng, latEnd, lngEnd, numPoints);
  const profile = await fetchElevationProfile(points, lat, lng);
  const stats = calcSlopeStats(profile);

  const id = crypto.randomUUID().slice(0, 12);

  const [slope] = await db
    .insert(slopes)
    .values({
      id,
      name: name.trim(),
      description: description?.trim() || null,
      lat,
      lng,
      latEnd,
      lngEnd,
      distance: stats.distance,
      elevationGain: stats.elevationGain,
      gradient: stats.gradient,
      crossStreets: 0,
      elevationProfile: profile,
      osmWayId: null,
      source: "manual",
      userId,
    })
    .returning();

  return NextResponse.json({ slope }, { status: 201 });
}
