CREATE TABLE "grupo" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grupo_animal" (
	"grupo_id" text NOT NULL,
	"animal_id" text NOT NULL,
	CONSTRAINT "grupo_animal_grupo_id_animal_id_pk" PRIMARY KEY("grupo_id","animal_id")
);
--> statement-breakpoint
CREATE TABLE "notificacao" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"texto" text NOT NULL,
	"link" text,
	"lida_em" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parto" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"animal_id" text NOT NULL,
	"ocorrencia_id" text,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"data" date NOT NULL,
	"crias" integer,
	"observacoes" text
);
--> statement-breakpoint
CREATE TABLE "pesagem" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"animal_id" text NOT NULL,
	"ocorrencia_id" text,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"peso_kg" numeric(7, 2) NOT NULL,
	"data" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tratamento" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"animal_id" text NOT NULL,
	"ocorrencia_id" text,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"remedio" text NOT NULL,
	"dose" text,
	"inicio" date NOT NULL,
	"fim" date,
	"carencia_dias" integer
);
--> statement-breakpoint
CREATE TABLE "vacina" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"animal_id" text NOT NULL,
	"ocorrencia_id" text,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"vacina" text NOT NULL,
	"dose" text,
	"data" date NOT NULL,
	"proxima_data" date
);
--> statement-breakpoint
ALTER TABLE "grupo" ADD CONSTRAINT "grupo_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_animal" ADD CONSTRAINT "grupo_animal_grupo_id_grupo_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grupo_animal" ADD CONSTRAINT "grupo_animal_animal_id_animal_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parto" ADD CONSTRAINT "parto_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parto" ADD CONSTRAINT "parto_animal_id_animal_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parto" ADD CONSTRAINT "parto_ocorrencia_id_ocorrencia_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "public"."ocorrencia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parto" ADD CONSTRAINT "parto_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesagem" ADD CONSTRAINT "pesagem_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesagem" ADD CONSTRAINT "pesagem_animal_id_animal_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesagem" ADD CONSTRAINT "pesagem_ocorrencia_id_ocorrencia_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "public"."ocorrencia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesagem" ADD CONSTRAINT "pesagem_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tratamento" ADD CONSTRAINT "tratamento_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tratamento" ADD CONSTRAINT "tratamento_animal_id_animal_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tratamento" ADD CONSTRAINT "tratamento_ocorrencia_id_ocorrencia_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "public"."ocorrencia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tratamento" ADD CONSTRAINT "tratamento_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacina" ADD CONSTRAINT "vacina_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacina" ADD CONSTRAINT "vacina_animal_id_animal_id_fk" FOREIGN KEY ("animal_id") REFERENCES "public"."animal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacina" ADD CONSTRAINT "vacina_ocorrencia_id_ocorrencia_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "public"."ocorrencia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacina" ADD CONSTRAINT "vacina_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grupo_organization_id_idx" ON "grupo" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "grupo_animal_animal_id_idx" ON "grupo_animal" USING btree ("animal_id");--> statement-breakpoint
CREATE INDEX "notificacao_user_org_idx" ON "notificacao" USING btree ("user_id","organization_id","created_at");--> statement-breakpoint
CREATE INDEX "parto_animal_id_idx" ON "parto" USING btree ("animal_id");--> statement-breakpoint
CREATE INDEX "pesagem_animal_id_idx" ON "pesagem" USING btree ("animal_id","data");--> statement-breakpoint
CREATE INDEX "tratamento_org_fim_idx" ON "tratamento" USING btree ("organization_id","fim");--> statement-breakpoint
CREATE INDEX "vacina_animal_id_idx" ON "vacina" USING btree ("animal_id","data");--> statement-breakpoint
CREATE INDEX "vacina_org_proxima_idx" ON "vacina" USING btree ("organization_id","proxima_data");--> statement-breakpoint
-- O peso que já estava no cadastro vira a primeira pesagem do histórico.
INSERT INTO "pesagem" ("id", "organization_id", "animal_id", "peso_kg", "data")
SELECT gen_random_uuid()::text, "organization_id", "id", "peso_kg", "updated_at"::date
FROM "animal" WHERE "peso_kg" IS NOT NULL;
