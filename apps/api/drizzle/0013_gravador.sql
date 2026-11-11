CREATE TABLE "gravador" (
	"id" text PRIMARY KEY NOT NULL,
	"serie" text NOT NULL,
	"nome" text NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"estado" jsonb NOT NULL,
	"visto_em" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gravador_serie_unique" UNIQUE("serie")
);
--> statement-breakpoint
ALTER TABLE "gravador" ADD CONSTRAINT "gravador_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gravador" ADD CONSTRAINT "gravador_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gravador_organization_id_idx" ON "gravador" USING btree ("organization_id");