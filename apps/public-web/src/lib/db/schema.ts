import {
  pgTable,
  text,
  date,
  integer,
  jsonb,
  timestamp,
  serial,
  uniqueIndex,
  index,
  doublePrecision,
} from "drizzle-orm/pg-core";

/** events テーブル */
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    name: text("name").notNull(),
    date: date("date").notNull(),
    dateEnd: date("date_end"),
    location: text("location").default(""),
    disciplines: jsonb("disciplines").default([]),
    maxEntries: integer("max_entries"),
    detailUrl: text("detail_url").default(""),
    entryDeadline: date("entry_deadline"),
    note: text("note"),
    pdfSize: integer("pdf_size"),
    fee: integer("fee"),
    actualFee: integer("actual_fee"),
    feeSource: text("fee_source"),
    scrapedAt: timestamp("scraped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_events_source_id").on(table.sourceId),
    index("idx_events_date").on(table.date),
  ]
);

/** entries テーブル */
export const entries = pgTable(
  "entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    eventName: text("event_name").notNull(),
    eventDate: text("event_date").notNull(),
    disciplines: jsonb("disciplines").default([]),
    status: text("status").default("submitted"),
    feePaid: integer("fee_paid"),
    serviceFeePaid: integer("service_fee_paid"),
    stripeSessionId: text("stripe_session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_entries_user_event").on(table.userId, table.eventId),
    index("idx_entries_user_id").on(table.userId),
  ]
);

/** venues テーブル（競技場マップ） */
export const venues = pgTable(
  "venues",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(), // "stadium" | "practice" | "powermax"
    name: text("name").notNull(),
    description: text("description"),
    address: text("address"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    keywords: jsonb("keywords").default([]),
    url: text("url"),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_venues_type").on(table.type)]
);

/** slopes テーブル（坂ダッシュマップ） */
export const slopes = pgTable(
  "slopes",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    latEnd: doublePrecision("lat_end").notNull(),
    lngEnd: doublePrecision("lng_end").notNull(),
    distance: doublePrecision("distance").notNull(),
    elevationGain: doublePrecision("elevation_gain").notNull(),
    gradient: doublePrecision("gradient").notNull(),
    crossStreets: integer("cross_streets").default(0),
    elevationProfile: jsonb("elevation_profile").default([]),
    geometry: jsonb("geometry").default([]),
    osmWayId: text("osm_way_id"),
    source: text("source").notNull(), // "auto" | "manual"
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_slopes_source").on(table.source),
    index("idx_slopes_osm_way_id").on(table.osmWayId),
  ]
);

/** health_checks テーブル */
export const healthChecks = pgTable(
  "health_checks",
  {
    id: serial("id").primaryKey(),
    siteId: text("site_id").notNull(),
    siteName: text("site_name").notNull(),
    year: integer("year").notNull(),
    eventCount: integer("event_count").default(0),
    pdfTotal: integer("pdf_total").default(0),
    pdfOk: integer("pdf_ok").default(0),
    pdfErrors: jsonb("pdf_errors").default([]),
    error: text("error"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_health_site_year").on(table.siteId, table.year),
  ]
);
