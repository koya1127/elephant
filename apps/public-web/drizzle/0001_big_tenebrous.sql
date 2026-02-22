ALTER TABLE "events" ADD COLUMN "fee" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "actual_fee" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "fee_source" text;