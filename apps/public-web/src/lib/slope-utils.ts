import type { ElevationPoint } from "./types";

const EARTH_RADIUS = 6371000; // meters

/** 2点間のHaversine距離 (m) */
export function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 2点間を等分割した緯度経度の配列を生成 */
export function interpolatePoints(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  numPoints: number
): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    points.push({
      lat: lat1 + (lat2 - lat1) * t,
      lng: lng1 + (lng2 - lng1) * t,
    });
  }
  return points;
}

/** 国土地理院 GSI API で1点の標高を取得 */
export async function fetchElevation(
  lat: number,
  lng: number
): Promise<number> {
  const url = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lng}&lat=${lat}&outtype=JSON`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GSI API error: ${res.status}`);
  const data = (await res.json()) as { elevation: number | string };
  const elev = typeof data.elevation === "string" ? parseFloat(data.elevation) : data.elevation;
  if (isNaN(elev)) return 0; // 海上等で"-----"が返る場合
  return elev;
}

/** 複数点の標高を順次取得（レート制限対応: 100msディレイ） */
export async function fetchElevationProfile(
  points: { lat: number; lng: number }[],
  startLat: number,
  startLng: number
): Promise<ElevationPoint[]> {
  const profile: ElevationPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const elev = await fetchElevation(p.lat, p.lng);
    const dist = i === 0 ? 0 : haversine(startLat, startLng, p.lat, p.lng);
    profile.push({ dist: Math.round(dist * 10) / 10, elev: Math.round(elev * 10) / 10 });
    // Rate limit: 100ms delay between requests
    if (i < points.length - 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return profile;
}

/** 標高プロファイルから坂の統計を計算 */
export function calcSlopeStats(profile: ElevationPoint[]): {
  distance: number;
  elevationGain: number;
  gradient: number;
} {
  if (profile.length < 2) {
    return { distance: 0, elevationGain: 0, gradient: 0 };
  }
  const distance = profile[profile.length - 1].dist;
  // 登り方向の獲得標高
  const elevStart = profile[0].elev;
  const elevEnd = profile[profile.length - 1].elev;
  const elevationGain = Math.abs(elevEnd - elevStart);
  const gradient = distance > 0 ? (elevationGain / distance) * 100 : 0;
  return {
    distance: Math.round(distance * 10) / 10,
    elevationGain: Math.round(elevationGain * 10) / 10,
    gradient: Math.round(gradient * 10) / 10,
  };
}

/** 勾配からカラーコードを取得（ポリライン用） */
export function gradientColor(gradient: number): string {
  if (gradient >= 12) return "#ef4444"; // red
  if (gradient >= 8) return "#eab308"; // yellow
  return "#22c55e"; // green
}

/** 勾配ラベル */
export function gradientLabel(gradient: number): string {
  if (gradient >= 12) return "急坂";
  if (gradient >= 8) return "中坂";
  return "緩坂";
}
