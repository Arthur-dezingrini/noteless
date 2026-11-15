-- Placas do tempo das contas não têm segredo: saem, e voltam aguardando aprovação
-- no próximo aviso com o firmware novo.
DELETE FROM "gravador";--> statement-breakpoint
ALTER TABLE "gravador" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "gravador" ADD COLUMN "segredo_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "gravador" ADD COLUMN "codigo" text NOT NULL;--> statement-breakpoint
ALTER TABLE "gravador" ADD COLUMN "aprovado_em" timestamp;