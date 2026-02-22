"use client";

import { useState, useEffect, useCallback } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { useUser, SignInButton } from "@clerk/nextjs";
import type { Venue, VenueType, Event } from "@/lib/types";
import { VenueInfoPanel } from "./VenueInfoPanel";
import { VenueAddForm } from "./VenueAddForm";
import styles from "./VenueMap.module.css";

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

const VENUE_TYPE_CONFIG: Record<VenueType, { label: string; bg: string; border: string; glyph: string }> = {
  stadium: { label: "競技場", bg: "#3b82f6", border: "#1d4ed8", glyph: "🏟" },
  practice: { label: "練習スポット", bg: "#22c55e", border: "#15803d", glyph: "🏃" },
  powermax: { label: "パワーマックス", bg: "#ef4444", border: "#b91c1c", glyph: "💪" },
};

export function VenueMap() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { user, isSignedIn } = useUser();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [addCoords, setAddCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<VenueType, boolean>>({
    stadium: true,
    practice: true,
    powermax: true,
  });

  const fetchVenues = useCallback(async () => {
    try {
      const res = await fetch("/api/venues");
      const data = await res.json();
      setVenues(data.venues || []);
    } catch (e) {
      console.error("Failed to fetch venues:", e);
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await fetchVenues();
      try {
        const res = await fetch("/api/scrape");
        const data = await res.json();
        const allEvents = (data as { events: Event[] }[]).flatMap((r) => r.events);
        const today = new Date().toISOString().slice(0, 10);
        setEvents(allEvents.filter((e) => e.date >= today));
      } catch (e) {
        console.error("Failed to fetch events:", e);
      }
      setLoading(false);
    }
    load();
  }, [fetchVenues]);

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (addMode && e.detail.latLng) {
        setAddCoords({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
        setSelectedVenue(null);
      }
    },
    [addMode]
  );

  const handleVenueAdded = useCallback(
    (venue: Venue) => {
      setVenues((prev) => [...prev, venue]);
      setAddMode(false);
      setAddCoords(null);
      setSelectedVenue(venue);
    },
    []
  );

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/venues/${id}`, { method: "DELETE" });
      if (res.ok) {
        setVenues((prev) => prev.filter((v) => v.id !== id));
        setSelectedVenue(null);
      }
    } catch (e) {
      console.error("Failed to delete venue:", e);
    }
  }, []);

  const toggleFilter = (type: VenueType) => {
    setFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  if (!apiKey) {
    return (
      <div className={styles.noKey}>
        <p>Google Maps API キーが設定されていません。</p>
        <p>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY を設定してください。</p>
      </div>
    );
  }

  const filteredVenues = venues.filter((v) => filters[v.type]);

  return (
    <APIProvider apiKey={apiKey}>
      <div className={styles.container}>
        {/* ツールバー */}
        <div className={styles.toolbar}>
          <div className={styles.filterGroup}>
            {(Object.entries(VENUE_TYPE_CONFIG) as [VenueType, typeof VENUE_TYPE_CONFIG.stadium][]).map(
              ([type, cfg]) => (
                <button
                  key={type}
                  className={`${styles.filterBtn} ${filters[type] ? styles.filterActive : ""}`}
                  style={filters[type] ? { backgroundColor: cfg.bg, borderColor: cfg.border, color: "#fff" } : {}}
                  onClick={() => toggleFilter(type)}
                >
                  {cfg.glyph} {cfg.label}
                  <span className={styles.filterCount}>
                    {venues.filter((v) => v.type === type).length}
                  </span>
                </button>
              )
            )}
          </div>

          <div className={styles.actions}>
            {isSignedIn ? (
              <button
                className={`${styles.addBtn} ${addMode ? styles.addBtnActive : ""}`}
                onClick={() => {
                  setAddMode(!addMode);
                  if (addMode) setAddCoords(null);
                }}
              >
                {addMode ? "キャンセル" : "+ 施設を追加"}
              </button>
            ) : (
              <SignInButton mode="modal">
                <button className={styles.addBtn}>ログインして施設を追加</button>
              </SignInButton>
            )}
          </div>
        </div>

        {addMode && (
          <div className={styles.addHint}>
            地図をクリックして場所を選択してください
          </div>
        )}

        {/* 地図 */}
        <div className={styles.mapArea}>
          <Map
            defaultCenter={{ lat: 43.2, lng: 143.0 }}
            defaultZoom={7}
            mapId={MAP_ID}
            gestureHandling="greedy"
            disableDefaultUI={false}
            className={styles.map}
            style={{ width: "100%", height: "100%" }}
            onClick={handleMapClick}
          >
            {filteredVenues.map((venue) => {
              const cfg = VENUE_TYPE_CONFIG[venue.type];
              return (
                <AdvancedMarker
                  key={venue.id}
                  position={{ lat: venue.lat, lng: venue.lng }}
                  title={venue.name}
                  onClick={() => {
                    setSelectedVenue(venue);
                    setAddCoords(null);
                  }}
                >
                  <Pin
                    background={cfg.bg}
                    borderColor={cfg.border}
                    glyphColor="#fff"
                    scale={selectedVenue?.id === venue.id ? 1.3 : 1.0}
                  >
                    <span style={{ fontSize: "14px" }}>{cfg.glyph}</span>
                  </Pin>
                </AdvancedMarker>
              );
            })}
          </Map>

          {/* InfoPanel */}
          {selectedVenue && !addCoords && (
            <VenueInfoPanel
              venue={selectedVenue}
              events={events}
              currentUserId={user?.id || null}
              isAdmin={
                (user?.publicMetadata as Record<string, unknown>)?.role === "admin"
              }
              onClose={() => setSelectedVenue(null)}
              onDelete={handleDelete}
            />
          )}

          {/* Add Form */}
          {addCoords && (
            <VenueAddForm
              lat={addCoords.lat}
              lng={addCoords.lng}
              onSubmit={handleVenueAdded}
              onCancel={() => setAddCoords(null)}
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
