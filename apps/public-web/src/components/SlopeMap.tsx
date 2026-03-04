"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { useUser, SignInButton } from "@clerk/nextjs";
import type { Slope, ElevationPoint } from "@/lib/types";
import { gradientColor } from "@/lib/slope-utils";
import { SlopeInfoPanel } from "./SlopeInfoPanel";
import { SlopeAddForm } from "./SlopeAddForm";
import styles from "./SlopeMap.module.css";

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

// google.maps types loaded at runtime via APIProvider; use `any` to avoid @types/google.maps dep
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GPolyline = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GMap = any;

/** ポリラインを描画するコンポーネント（google.maps.Polyline直接操作） */
function SlopePolylines({
  slopes,
  selectedId,
  onSelect,
}: {
  slopes: Slope[];
  selectedId: string | null;
  onSelect: (slope: Slope) => void;
}) {
  const map = useMap();
  const polylinesRef = useRef<GPolyline[]>([]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gm = typeof window !== "undefined" ? (window as any).google : null;
    if (!map || !gm) return;

    // 既存ポリラインをクリア
    for (const pl of polylinesRef.current) {
      pl.setMap(null);
    }
    polylinesRef.current = [];

    for (const slope of slopes) {
      const profile = slope.elevationProfile as ElevationPoint[] | undefined;
      // ポリラインのパスを構築（プロファイルがあれば中間点も使う）
      let path: { lat: number; lng: number }[];
      if (profile && profile.length >= 2) {
        const totalDist = profile[profile.length - 1].dist;
        path = profile.map((p) => {
          if (totalDist === 0) return { lat: slope.lat, lng: slope.lng };
          const t = p.dist / totalDist;
          return {
            lat: slope.lat + (slope.latEnd - slope.lat) * t,
            lng: slope.lng + (slope.lngEnd - slope.lng) * t,
          };
        });
      } else {
        path = [
          { lat: slope.lat, lng: slope.lng },
          { lat: slope.latEnd, lng: slope.lngEnd },
        ];
      }

      const isSelected = slope.id === selectedId;
      const color = gradientColor(slope.gradient);

      const polyline = new gm.maps.Polyline({
        path,
        strokeColor: color,
        strokeWeight: isSelected ? 6 : 4,
        strokeOpacity: isSelected ? 1.0 : 0.7,
        map,
        zIndex: isSelected ? 10 : 1,
      });

      polyline.addListener("click", () => onSelect(slope));
      polylinesRef.current.push(polyline);
    }

    return () => {
      for (const pl of polylinesRef.current) {
        pl.setMap(null);
      }
      polylinesRef.current = [];
    };
  }, [map, slopes, selectedId, onSelect]);

  return null;
}

export function SlopeMap() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { user, isSignedIn } = useUser();

  const [slopes, setSlopes] = useState<Slope[]>([]);
  const [selectedSlope, setSelectedSlope] = useState<Slope | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [startCoords, setStartCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [endCoords, setEndCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);

  const isAdmin =
    (user?.publicMetadata as Record<string, unknown>)?.role === "admin";

  const fetchSlopes = useCallback(async () => {
    try {
      const res = await fetch("/api/slopes");
      const data = await res.json();
      setSlopes(data.slopes || []);
    } catch (e) {
      console.error("Failed to fetch slopes:", e);
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await fetchSlopes();
      setLoading(false);
    }
    load();
  }, [fetchSlopes]);

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (!addMode || !e.detail.latLng) return;
      const coord = { lat: e.detail.latLng.lat, lng: e.detail.latLng.lng };

      if (!startCoords) {
        // 1クリック目: スタート地点
        setStartCoords(coord);
        setEndCoords(null);
        setSelectedSlope(null);
      } else if (!endCoords) {
        // 2クリック目: ゴール地点
        setEndCoords(coord);
      }
    },
    [addMode, startCoords, endCoords]
  );

  const handleSlopeAdded = useCallback((slope: Slope) => {
    setSlopes((prev) => [...prev, slope]);
    setAddMode(false);
    setStartCoords(null);
    setEndCoords(null);
    setSelectedSlope(slope);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/slopes/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSlopes((prev) => prev.filter((s) => s.id !== id));
        setSelectedSlope(null);
      }
    } catch (e) {
      console.error("Failed to delete slope:", e);
    }
  }, []);

  const handleDetect = useCallback(
    async (map: GMap) => {
      if (!isAdmin || detecting) return;
      const bounds = map.getBounds();
      if (!bounds) return;

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      setDetecting(true);
      try {
        const res = await fetch("/api/slopes/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            south: sw.lat(),
            west: sw.lng(),
            north: ne.lat(),
            east: ne.lng(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "検出に失敗しました");
          return;
        }
        alert(`${data.totalWays} 道路を解析、${data.detected} 坂を検出しました`);
        await fetchSlopes();
      } catch (e) {
        console.error("Detect failed:", e);
        alert("検出に失敗しました");
      } finally {
        setDetecting(false);
      }
    },
    [isAdmin, detecting, fetchSlopes]
  );

  const cancelAdd = () => {
    setAddMode(false);
    setStartCoords(null);
    setEndCoords(null);
  };

  if (!apiKey) {
    return (
      <div className={styles.noKey}>
        <p>Google Maps API キーが設定されていません。</p>
        <p>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY を設定してください。</p>
      </div>
    );
  }

  const addHintText = !startCoords
    ? "地図をクリックしてスタート地点を選択"
    : !endCoords
      ? "地図をクリックしてゴール地点を選択"
      : null;

  return (
    <APIProvider apiKey={apiKey}>
      <div className={styles.container}>
        {/* ツールバー */}
        <div className={styles.toolbar}>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: "#22c55e" }} />
              緩坂 5-8%
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: "#eab308" }} />
              中坂 8-12%
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: "#ef4444" }} />
              急坂 12%+
            </span>
            <span className={styles.slopeCount}>{slopes.length} 件</span>
          </div>

          <div className={styles.actions}>
            {isSignedIn ? (
              <button
                className={`${styles.addBtn} ${addMode ? styles.addBtnActive : ""}`}
                onClick={() => {
                  if (addMode) cancelAdd();
                  else {
                    setAddMode(true);
                    setSelectedSlope(null);
                  }
                }}
              >
                {addMode ? "キャンセル" : "+ 坂を追加"}
              </button>
            ) : (
              <SignInButton mode="modal">
                <button className={styles.addBtn}>ログインして坂を追加</button>
              </SignInButton>
            )}
          </div>
        </div>

        {addMode && addHintText && (
          <div className={styles.addHint}>{addHintText}</div>
        )}

        {/* 地図 */}
        <div className={styles.mapArea}>
          <MapInner
            slopes={slopes}
            selectedSlope={selectedSlope}
            startCoords={startCoords}
            endCoords={endCoords}
            addMode={addMode}
            isAdmin={isAdmin}
            detecting={detecting}
            onMapClick={handleMapClick}
            onSelectSlope={setSelectedSlope}
            onDetect={handleDetect}
          />

          {/* InfoPanel */}
          {selectedSlope && !endCoords && (
            <SlopeInfoPanel
              slope={selectedSlope}
              currentUserId={user?.id || null}
              isAdmin={isAdmin}
              onClose={() => setSelectedSlope(null)}
              onDelete={handleDelete}
            />
          )}

          {/* Add Form */}
          {startCoords && endCoords && (
            <SlopeAddForm
              startCoords={startCoords}
              endCoords={endCoords}
              onSubmit={handleSlopeAdded}
              onCancel={cancelAdd}
            />
          )}
        </div>

        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            読み込み中...
          </div>
        )}
      </div>
    </APIProvider>
  );
}

/** Map内部コンポーネント（useMapを使うためAPIProvider内に配置） */
function MapInner({
  slopes,
  selectedSlope,
  startCoords,
  endCoords,
  addMode,
  isAdmin,
  detecting,
  onMapClick,
  onSelectSlope,
  onDetect,
}: {
  slopes: Slope[];
  selectedSlope: Slope | null;
  startCoords: { lat: number; lng: number } | null;
  endCoords: { lat: number; lng: number } | null;
  addMode: boolean;
  isAdmin: boolean;
  detecting: boolean;
  onMapClick: (e: MapMouseEvent) => void;
  onSelectSlope: (slope: Slope) => void;
  onDetect: (map: GMap) => void;
}) {
  const map = useMap();

  return (
    <>
      <Map
        defaultCenter={{ lat: 43.05, lng: 141.35 }}
        defaultZoom={13}
        mapId={MAP_ID}
        gestureHandling="greedy"
        disableDefaultUI={false}
        className={styles.map}
        style={{ width: "100%", height: "100%" }}
        onClick={onMapClick}
      >
        {/* ポリライン描画 */}
        <SlopePolylines
          slopes={slopes}
          selectedId={selectedSlope?.id || null}
          onSelect={onSelectSlope}
        />

        {/* スタートマーカー（追加モード） */}
        {startCoords && (
          <AdvancedMarker position={startCoords} title="スタート">
            <Pin background="#22c55e" borderColor="#15803d" glyphColor="#fff" scale={0.8}>
              <span style={{ fontSize: "12px" }}>S</span>
            </Pin>
          </AdvancedMarker>
        )}

        {/* ゴールマーカー（追加モード） */}
        {endCoords && (
          <AdvancedMarker position={endCoords} title="ゴール">
            <Pin background="#ef4444" borderColor="#b91c1c" glyphColor="#fff" scale={0.8}>
              <span style={{ fontSize: "12px" }}>G</span>
            </Pin>
          </AdvancedMarker>
        )}
      </Map>

      {/* 管理者用: 検出ボタン */}
      {isAdmin && !addMode && map && (
        <button
          className={styles.detectBtn}
          onClick={() => onDetect(map)}
          disabled={detecting}
        >
          {detecting ? "検出中..." : "このエリアで坂を検出"}
        </button>
      )}
    </>
  );
}
