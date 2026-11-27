CREATE TABLE "entrada" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"fornecedor_id" text,
	"numero_nota" text,
	"serie" text,
	"chave_nfe" text,
	"data_emissao" date,
	"data" date NOT NULL,
	"valor_total" numeric(14, 2),
	"origem" text NOT NULL,
	"xml" text,
	"estornada_em" timestamp,
	"ocorrencia_id" text
);
--> statement-breakpoint
CREATE TABLE "fornecedor" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"documento" text,
	"telefone" text
);
--> statement-breakpoint
CREATE TABLE "inventario" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"local_id" text NOT NULL,
	"status" text DEFAULT 'aberto' NOT NULL,
	"aberto_em" timestamp DEFAULT now() NOT NULL,
	"fechado_em" timestamp,
	"fechado_por_id" text
);
--> statement-breakpoint
CREATE TABLE "inventario_item" (
	"id" text PRIMARY KEY NOT NULL,
	"inventario_id" text NOT NULL,
	"produto_id" text NOT NULL,
	"lote_fabricacao" text DEFAULT '' NOT NULL,
	"quantidade_contada" numeric(14, 3) NOT NULL,
	"quantidade_sistema" numeric(14, 3)
);
--> statement-breakpoint
CREATE TABLE "local_estoque" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"tipo" text NOT NULL,
	"instalacao_id" text,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimento_estoque" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"produto_id" text NOT NULL,
	"local_id" text NOT NULL,
	"lote_fabricacao" text DEFAULT '' NOT NULL,
	"validade" date,
	"tipo" text NOT NULL,
	"quantidade" numeric(14, 3) NOT NULL,
	"custo_unitario" numeric(14, 4) DEFAULT '0' NOT NULL,
	"data" date NOT NULL,
	"origem_tipo" text NOT NULL,
	"origem_id" text,
	"grupo_id" text,
	"estorna_id" text,
	"motivo" text,
	"ocorrencia_id" text
);
--> statement-breakpoint
CREATE TABLE "produto" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"categoria" text NOT NULL,
	"unidade" text NOT NULL,
	"embalagem_nome" text,
	"embalagem_fator" numeric(14, 4),
	"estoque_minimo" numeric(14, 3),
	"controla_lote" boolean DEFAULT false NOT NULL,
	"custo_medio" numeric(14, 4) DEFAULT '0' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produto_fornecedor" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"criado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"fornecedor_id" text NOT NULL,
	"codigo" text NOT NULL,
	"unidade_compra" text NOT NULL,
	"fator" numeric(14, 4) NOT NULL,
	"produto_id" text NOT NULL,
	"local_id" text
);
--> statement-breakpoint
CREATE TABLE "saldo_estoque" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"produto_id" text NOT NULL,
	"local_id" text NOT NULL,
	"lote_fabricacao" text DEFAULT '' NOT NULL,
	"validade" date,
	"quantidade" numeric(14, 3) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entrada" ADD CONSTRAINT "entrada_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada" ADD CONSTRAINT "entrada_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada" ADD CONSTRAINT "entrada_fornecedor_id_fornecedor_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada" ADD CONSTRAINT "entrada_ocorrencia_id_ocorrencia_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "public"."ocorrencia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fornecedor" ADD CONSTRAINT "fornecedor_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fornecedor" ADD CONSTRAINT "fornecedor_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_local_id_local_estoque_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."local_estoque"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_fechado_por_id_user_id_fk" FOREIGN KEY ("fechado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventario_item" ADD CONSTRAINT "inventario_item_inventario_id_inventario_id_fk" FOREIGN KEY ("inventario_id") REFERENCES "public"."inventario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventario_item" ADD CONSTRAINT "inventario_item_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_estoque" ADD CONSTRAINT "local_estoque_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_estoque" ADD CONSTRAINT "local_estoque_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_estoque" ADD CONSTRAINT "local_estoque_instalacao_id_instalacao_id_fk" FOREIGN KEY ("instalacao_id") REFERENCES "public"."instalacao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimento_estoque" ADD CONSTRAINT "movimento_estoque_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimento_estoque" ADD CONSTRAINT "movimento_estoque_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimento_estoque" ADD CONSTRAINT "movimento_estoque_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimento_estoque" ADD CONSTRAINT "movimento_estoque_local_id_local_estoque_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."local_estoque"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimento_estoque" ADD CONSTRAINT "movimento_estoque_estorna_id_movimento_estoque_id_fk" FOREIGN KEY ("estorna_id") REFERENCES "public"."movimento_estoque"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimento_estoque" ADD CONSTRAINT "movimento_estoque_ocorrencia_id_ocorrencia_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "public"."ocorrencia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto" ADD CONSTRAINT "produto_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto" ADD CONSTRAINT "produto_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_fornecedor" ADD CONSTRAINT "produto_fornecedor_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_fornecedor" ADD CONSTRAINT "produto_fornecedor_criado_por_id_user_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_fornecedor" ADD CONSTRAINT "produto_fornecedor_fornecedor_id_fornecedor_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_fornecedor" ADD CONSTRAINT "produto_fornecedor_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_fornecedor" ADD CONSTRAINT "produto_fornecedor_local_id_local_estoque_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."local_estoque"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saldo_estoque" ADD CONSTRAINT "saldo_estoque_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saldo_estoque" ADD CONSTRAINT "saldo_estoque_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saldo_estoque" ADD CONSTRAINT "saldo_estoque_local_id_local_estoque_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."local_estoque"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entrada_org_chave_nfe_uq" ON "entrada" USING btree ("organization_id","chave_nfe");--> statement-breakpoint
CREATE UNIQUE INDEX "fornecedor_org_documento_uq" ON "fornecedor" USING btree ("organization_id","documento");--> statement-breakpoint
CREATE UNIQUE INDEX "inventario_local_aberto_uq" ON "inventario" USING btree ("local_id") WHERE "status" = 'aberto';--> statement-breakpoint
CREATE UNIQUE INDEX "inventario_item_uq" ON "inventario_item" USING btree ("inventario_id","produto_id","lote_fabricacao");--> statement-breakpoint
CREATE UNIQUE INDEX "local_estoque_org_nome_uq" ON "local_estoque" USING btree ("organization_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "local_estoque_silo_ativo_uq" ON "local_estoque" USING btree ("instalacao_id") WHERE "ativo" = true AND "tipo" = 'silo';--> statement-breakpoint
CREATE INDEX "movimento_estoque_org_produto_data_idx" ON "movimento_estoque" USING btree ("organization_id","produto_id","data");--> statement-breakpoint
CREATE INDEX "movimento_estoque_org_origem_idx" ON "movimento_estoque" USING btree ("organization_id","origem_tipo","origem_id");--> statement-breakpoint
CREATE INDEX "movimento_estoque_org_lote_idx" ON "movimento_estoque" USING btree ("organization_id","lote_fabricacao");--> statement-breakpoint
CREATE UNIQUE INDEX "movimento_estoque_estorna_uq" ON "movimento_estoque" USING btree ("estorna_id");--> statement-breakpoint
CREATE UNIQUE INDEX "produto_org_nome_uq" ON "produto" USING btree ("organization_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "produto_fornecedor_codigo_uq" ON "produto_fornecedor" USING btree ("fornecedor_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "saldo_estoque_produto_local_lote_uq" ON "saldo_estoque" USING btree ("produto_id","local_id","lote_fabricacao");