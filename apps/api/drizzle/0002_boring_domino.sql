CREATE TABLE "animal" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"nome" text NOT NULL,
	"especie" text NOT NULL,
	"raca" text,
	"sexo" text,
	"nascimento" date,
	"peso_kg" numeric(7, 2),
	"tutor" text,
	"tutor_telefone" text,
	"ultima_visita" date,
	"status" text DEFAULT 'ativo' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "animal" ADD CONSTRAINT "animal_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "animal_organization_id_idx" ON "animal" USING btree ("organization_id");