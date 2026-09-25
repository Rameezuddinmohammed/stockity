CREATE TABLE "approved_emails" (
	"email_canonical" text PRIMARY KEY NOT NULL,
	"university_id" uuid NOT NULL,
	"note" text,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"modes" text[] DEFAULT '{}'::text[] NOT NULL,
	"free_hours_utc" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
	"timezone" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approved_emails" ADD CONSTRAINT "approved_emails_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approved_emails" ADD CONSTRAINT "approved_emails_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;