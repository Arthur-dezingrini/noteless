ALTER TABLE "vacinacao_lote" ADD COLUMN "produto_id" text;--> statement-breakpoint
ALTER TABLE "vacinacao_lote" ADD COLUMN "quantidade" numeric(14, 3);--> statement-breakpoint
ALTER TABLE "tratamento" ADD COLUMN "produto_id" text;--> statement-breakpoint
ALTER TABLE "tratamento" ADD COLUMN "quantidade" numeric(14, 3);--> statement-breakpoint
ALTER TABLE "vacina" ADD COLUMN "produto_id" text;--> statement-breakpoint
ALTER TABLE "vacina" ADD COLUMN "quantidade" numeric(14, 3);--> statement-breakpoint
ALTER TABLE "vacinacao_lote" ADD CONSTRAINT "vacinacao_lote_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tratamento" ADD CONSTRAINT "tratamento_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacina" ADD CONSTRAINT "vacina_produto_id_produto_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto"("id") ON DELETE set null ON UPDATE no action;