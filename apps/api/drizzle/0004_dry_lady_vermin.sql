CREATE TABLE "anotacao_animal" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"animal_id" text NOT NULL,
	"ocorrencia_id" text,
	"criado_por_id" text,
	"texto" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocorrencia" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"status" text DEFAULT 'pendente' NOT NULL,
	"transcricao" text NOT NULL,
	"resumo" text NOT NULL,
	"duracao_seg" integer,
	"operacoes" jsonb NOT NULL,
	"revisado_por_id" text,
	"revisado_em" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anotacao_animal" ADD CONSTRAINT "anotacao_animal_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anotacao_animal" ADD CONSTRAINT "anotacao_animal_animal_id_animal_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anotacao_animal" ADD CONSTRAINT "anotacao_animal_ocorrencia_id_ocorrencia_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "public"."ocorrencia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anotacao_animal" ADD CONSTRAINT "anotacao_animal_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocorrencia" ADD CONSTRAINT "ocorrencia_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocorrencia" ADD CONSTRAINT "ocorrencia_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocorrencia" ADD CONSTRAINT "ocorrencia_revisado_por_id_user_id_fk" FOREIGN KEY ("revisado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anotacao_animal_animal_id_idx" ON "anotacao_animal" USING btree ("animal_id");--> statement-breakpoint
CREATE INDEX "ocorrencia_organization_id_status_idx" ON "ocorrencia" USING btree ("organization_id","status");