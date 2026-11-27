DROP INDEX "entrada_org_chave_nfe_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "entrada_org_chave_nfe_uq" ON "entrada" USING btree ("organization_id","chave_nfe") WHERE "estornada_em" IS NULL;