CREATE TABLE "slopes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"lat_end" double precision NOT NULL,
	"lng_end" double precision NOT NULL,
	"distance" double precision NOT NULL,
	"elevation_gain" double precision NOT NULL,
	"gradient" double precision NOT NULL,
	"cross_streets" integer DEFAULT 0,
	"elevation_profile" jsonb DEFAULT '[]'::jsonb,
	"osm_way_id" text,
	"source" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_slopes_source" ON "slopes" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_slopes_osm_way_id" ON "slopes" USING btree ("osm_way_id");