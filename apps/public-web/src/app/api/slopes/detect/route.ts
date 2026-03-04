import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { slopes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  haversine,
  fetchElevationProfile,
  calcSlopeStats,
} from "@/lib/slope-utils";

export const runtime = "nodejs";
export const maxDuration = 300; // 5分

interface OverpassWay {
  id: number;
  geometry: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

interface OverpassNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
}

interface OverpassElement {
  type: string;
  id: number;
  geometry?: { lat: number; lon: number }[];
  nodes?: number[];
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
}

/** Overpass APIで指定bboxの道路を取得 */
async function fetchRoads(
  south: number,
  west: number,
  north: number,
  east: number
): Promise<{ ways: OverpassWay[]; nodeCounts: Map<number, number> }> {
  // residential以上の道路 + 歩道・自転車道も含む
  const query = `
    [out:json][timeout:60];
    (
      way["highway"~"^(residential|unclassified|tertiary|secondary|primary|footway|cycleway|path|track)$"]
        (${south},${west},${north},${east});
    );
    out geom;
    >;
    out skel;
  `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  const data = (await res.json()) as { elements: OverpassElement[] };

  const ways: OverpassWay[] = [];
  // ノードの参照カウント（交差点検出用）
  const nodeCounts = new Map<number, number>();

  for (const el of data.elements) {
    if (el.type === "way" && el.geometry) {
      ways.push({
        id: el.id,
        geometry: el.geometry,
        tags: el.tags,
      });
      // ノードカウント
      if (el.nodes) {
        for (const nid of el.nodes) {
          nodeCounts.set(nid, (nodeCounts.get(nid) || 0) + 1);
        }
      }
    }
  }

  return { ways, nodeCounts };
}

/** wayのノードのうち複数wayで共有されているもの = 交差点 */
function countCrossStreets(
  way: OverpassWay & { nodes?: number[] },
  nodeCounts: Map<number, number>
): number {
  if (!("nodes" in way) || !Array.isArray((way as OverpassElement).nodes)) return 0;
  const nodes = (way as OverpassElement).nodes!;
  // 端点以外で複数wayに属するノード数
  let count = 0;
  for (let i = 1; i < nodes.length - 1; i++) {
    if ((nodeCounts.get(nodes[i]) || 0) > 1) count++;
  }
  return count;
}

/** POST /api/slopes/detect — 自動検出（admin専用） */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  // admin チェック
  let isAdmin = false;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    isAdmin = (user.publicMetadata as Record<string, unknown>)?.role === "admin";
  } catch {
    // pass
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const body = await req.json();
  const { south, west, north, east } = body as {
    south: number;
    west: number;
    north: number;
    east: number;
  };

  if (south == null || west == null || north == null || east == null) {
    return NextResponse.json(
      { error: "south, west, north, east は必須です" },
      { status: 400 }
    );
  }

  // bbox が大きすぎないかチェック（最大5km四方）
  const widthKm = haversine(south, west, south, east) / 1000;
  const heightKm = haversine(south, west, north, west) / 1000;
  if (widthKm > 5 || heightKm > 5) {
    return NextResponse.json(
      { error: "検出エリアが大きすぎます（最大5km四方）" },
      { status: 400 }
    );
  }

  // Overpass APIで道路取得
  const { ways, nodeCounts } = await fetchRoads(south, west, north, east);

  const detected: Array<{
    osmWayId: string;
    name: string;
    distance: number;
    gradient: number;
  }> = [];

  for (const way of ways) {
    // 距離フィルター: 直線50-500m
    const geom = way.geometry;
    if (geom.length < 2) continue;

    const dist = haversine(
      geom[0].lat,
      geom[0].lon,
      geom[geom.length - 1].lat,
      geom[geom.length - 1].lon
    );
    if (dist < 50 || dist > 500) continue;

    // 交差点チェック（中間ノードで2つ以上の交差 = 車多め）
    const crosses = countCrossStreets(
      way as OverpassWay & { nodes?: number[] },
      nodeCounts
    );
    if (crosses > 3) continue;

    // 標高プロファイル取得（10点サンプリング）
    const samplePoints = [];
    const step = Math.max(1, Math.floor(geom.length / 10));
    for (let i = 0; i < geom.length; i += step) {
      samplePoints.push({ lat: geom[i].lat, lng: geom[i].lon });
    }
    // 必ず最終点を含める
    const last = geom[geom.length - 1];
    const lastSample = samplePoints[samplePoints.length - 1];
    if (lastSample.lat !== last.lat || lastSample.lng !== last.lon) {
      samplePoints.push({ lat: last.lat, lng: last.lon });
    }

    const profile = await fetchElevationProfile(
      samplePoints,
      geom[0].lat,
      geom[0].lon
    );
    const stats = calcSlopeStats(profile);

    // 勾配5%未満はスキップ
    if (stats.gradient < 5) continue;

    // 既存チェック（osmWayIdで重複排除）
    const osmId = String(way.id);
    const existing = await db
      .select({ id: slopes.id })
      .from(slopes)
      .where(eq(slopes.osmWayId, osmId));

    if (existing.length > 0) {
      detected.push({
        osmWayId: osmId,
        name: way.tags?.name || `坂道 #${osmId}`,
        distance: stats.distance,
        gradient: stats.gradient,
      });
      continue;
    }

    // DB保存
    const id = crypto.randomUUID().slice(0, 12);
    const slopeName = way.tags?.name || `坂道 #${osmId}`;

    await db.insert(slopes).values({
      id,
      name: slopeName,
      description: null,
      lat: geom[0].lat,
      lng: geom[0].lon,
      latEnd: last.lat,
      lngEnd: last.lon,
      distance: stats.distance,
      elevationGain: stats.elevationGain,
      gradient: stats.gradient,
      crossStreets: crosses,
      elevationProfile: profile,
      osmWayId: osmId,
      source: "auto",
      userId,
    });

    detected.push({
      osmWayId: osmId,
      name: slopeName,
      distance: stats.distance,
      gradient: stats.gradient,
    });
  }

  return NextResponse.json({
    totalWays: ways.length,
    detected: detected.length,
    slopes: detected,
  });
}
