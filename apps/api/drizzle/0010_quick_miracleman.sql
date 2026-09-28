CREATE TABLE "prontuario" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"animal_id" text NOT NULL,
	"consulta_id" text,
	"veterinario_id" text,
	"data" date NOT NULL,
	"tipo" text NOT NULL,
	"queixa" text DEFAULT '' NOT NULL,
	"exame" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"diagnostico" text DEFAULT '' NOT NULL,
	"remedios" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exames" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"retorno_id" text,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prontuario_consulta_id_unique" UNIQUE("consulta_id")
);
--> statement-breakpoint
ALTER TABLE "prontuario" ADD CONSTRAINT "prontuario_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prontuario" ADD CONSTRAINT "prontuario_animal_id_animal_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prontuario" ADD CONSTRAINT "prontuario_consulta_id_consulta_id_fk" FOREIGN KEY ("consulta_id") REFERENCES "public"."consulta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prontuario" ADD CONSTRAINT "prontuario_veterinario_id_user_id_fk" FOREIGN KEY ("veterinario_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prontuario" ADD CONSTRAINT "prontuario_retorno_id_consulta_id_fk" FOREIGN KEY ("retorno_id") REFERENCES "public"."consulta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prontuario" ADD CONSTRAINT "prontuario_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prontuario_organization_id_data_idx" ON "prontuario" USING btree ("organization_id","data");--> statement-breakpoint
CREATE INDEX "prontuario_animal_id_idx" ON "prontuario" USING btree ("animal_id");