CREATE TABLE "entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_id" text NOT NULL,
	"event_name" text NOT NULL,
	"event_date" text NOT NULL,
	"disciplines" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'submitted',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"date_end" date,
	"location" text DEFAULT '',
	"disciplines" jsonb DEFAULT '[]'::jsonb,
	"max_entries" integer,
	"detail_url" text DEFAULT '',
	"entry_deadline" date,
	"note" text,
	"pdf_size" integer,
	"scraped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "health_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"site_name" text NOT NULL,
	"year" integer NOT NULL,
	"event_count" integer DEFAULT 0,
	"pdf_total" integer DEFAULT 0,
	"pdf_ok" integer DEFAULT 0,
	"pdf_errors" jsonb DEFAULT '[]'::jsonb,
	"error" text,
	"checked_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_entries_user_event" ON "entries" USING btree ("user_id","event_id");--> statement-breakpoint
CREATE INDEX "idx_entries_user_id" ON "entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_events_source_id" ON "events" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_events_date" ON "events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_health_site_year" ON "health_checks" USING btree ("site_id","year");