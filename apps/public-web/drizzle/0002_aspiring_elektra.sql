ALTER TABLE "entries" ADD COLUMN "fee_paid" integer;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "service_fee_paid" integer;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "stripe_session_id" text;