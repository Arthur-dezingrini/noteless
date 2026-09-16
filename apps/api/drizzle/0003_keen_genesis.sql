CREATE TABLE "consulta" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"animal_id" text NOT NULL,
	"veterinario_id" text,
	"data" date NOT NULL,
	"hora" text NOT NULL,
	"duracao_min" integer DEFAULT 30 NOT NULL,
	"tipo" text NOT NULL,
	"status" text DEFAULT 'agendada' NOT NULL,
	"observacoes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_animal_id_animal_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_veterinario_id_user_id_fk" FOREIGN KEY ("veterinario_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consulta_organization_id_data_idx" ON "consulta" USING btree ("organization_id","data");--> statement-breakpoint
CREATE INDEX "consulta_animal_id_idx" ON "consulta" USING btree ("animal_id");