CREATE TABLE "alojamento" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"lote_id" text NOT NULL,
	"instalacao_id" text NOT NULL,
	"inicio" date NOT NULL,
	"fim" date,
	"femeas" integer NOT NULL,
	"machos" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apontamento_aviario" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ocorrencia_id" text,
	"instalacao_id" text NOT NULL,
	"lote_id" text NOT NULL,
	"data" date NOT NULL,
	"mortas_femeas" integer,
	"mortas_machos" integer,
	"eliminadas_femeas" integer,
	"eliminadas_machos" integer,
	"ovos_total" integer,
	"ovos_incubaveis" integer,
	"ovos_trincados" integer,
	"ovos_sujos" integer,
	"ovos_duas_gemas" integer,
	"ovos_descarte" integer,
	"racao_kg" numeric(10, 2),
	"agua_l" numeric(10, 2),
	"observacoes" text
);
--> statement-breakpoint
CREATE TABLE "instalacao" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"tipo" text NOT NULL,
	"capacidade" integer,
	"area_m2" numeric(10, 2),
	"ativa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lote" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"codigo" text NOT NULL,
	"especie" text NOT NULL,
	"linhagem" text,
	"data_alojamento" date NOT NULL,
	"idade_alojamento_dias" integer DEFAULT 0 NOT NULL,
	"femeas_iniciais" integer NOT NULL,
	"machos_iniciais" integer NOT NULL,
	"fase" text DEFAULT 'recria' NOT NULL,
	"situacao" text DEFAULT 'ativo' NOT NULL,
	"data_encerramento" date
);
--> statement-breakpoint
CREATE TABLE "pesagem_lote" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ocorrencia_id" text,
	"lote_id" text NOT NULL,
	"instalacao_id" text,
	"data" date NOT NULL,
	"sexo" text NOT NULL,
	"peso_medio_g" numeric(8, 2) NOT NULL,
	"uniformidade_pct" numeric(5, 2),
	"amostra" integer
);
--> statement-breakpoint
CREATE TABLE "vacinacao_lote" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ocorrencia_id" text,
	"lote_id" text NOT NULL,
	"vacina" text NOT NULL,
	"via" text,
	"data" date NOT NULL,
	"proxima_data" date
);
--> statement-breakpoint
ALTER TABLE "alojamento" ADD CONSTRAINT "alojamento_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alojamento" ADD CONSTRAINT "alojamento_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alojamento" ADD CONSTRAINT "alojamento_lote_id_lote_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alojamento" ADD CONSTRAINT "alojamento_instalacao_id_instalacao_id_fk" FOREIGN KEY ("instalacao_id") REFERENCES "public"."instalacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apontamento_aviario" ADD CONSTRAINT "apontamento_aviario_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apontamento_aviario" ADD CONSTRAINT "apontamento_aviario_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apontamento_aviario" ADD CONSTRAINT "apontamento_aviario_ocorrencia_id_ocorrencia_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "public"."ocorrencia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apontamento_aviario" ADD CONSTRAINT "apontamento_aviario_instalacao_id_instalacao_id_fk" FOREIGN KEY ("instalacao_id") REFERENCES "public"."instalacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apontamento_aviario" ADD CONSTRAINT "apontamento_aviario_lote_id_lote_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instalacao" ADD CONSTRAINT "instalacao_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instalacao" ADD CONSTRAINT "instalacao_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lote" ADD CONSTRAINT "lote_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lote" ADD CONSTRAINT "lote_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesagem_lote" ADD CONSTRAINT "pesagem_lote_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesagem_lote" ADD CONSTRAINT "pesagem_lote_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesagem_lote" ADD CONSTRAINT "pesagem_lote_ocorrencia_id_ocorrencia_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "public"."ocorrencia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesagem_lote" ADD CONSTRAINT "pesagem_lote_lote_id_lote_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesagem_lote" ADD CONSTRAINT "pesagem_lote_instalacao_id_instalacao_id_fk" FOREIGN KEY ("instalacao_id") REFERENCES "public"."instalacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacinacao_lote" ADD CONSTRAINT "vacinacao_lote_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacinacao_lote" ADD CONSTRAINT "vacinacao_lote_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacinacao_lote" ADD CONSTRAINT "vacinacao_lote_ocorrencia_id_ocorrencia_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "public"."ocorrencia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacinacao_lote" ADD CONSTRAINT "vacinacao_lote_lote_id_lote_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alojamento_instalacao_inicio_idx" ON "alojamento" USING btree ("instalacao_id","inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "apontamento_aviario_instalacao_data_uq" ON "apontamento_aviario" USING btree ("instalacao_id","data");--> statement-breakpoint
CREATE INDEX "apontamento_aviario_lote_data_idx" ON "apontamento_aviario" USING btree ("lote_id","data");--> statement-breakpoint
CREATE UNIQUE INDEX "instalacao_org_nome_uq" ON "instalacao" USING btree ("organization_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "lote_org_codigo_uq" ON "lote" USING btree ("organization_id","codigo");--> statement-breakpoint
CREATE INDEX "pesagem_lote_lote_data_idx" ON "pesagem_lote" USING btree ("lote_id","data");--> statement-breakpoint
CREATE INDEX "vacinacao_lote_org_proxima_idx" ON "vacinacao_lote" USING btree ("organization_id","proxima_data");