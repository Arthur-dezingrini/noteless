ALTER TABLE "ocorrencia" ADD COLUMN "encaminhada_por_id" text;--> statement-breakpoint
ALTER TABLE "ocorrencia" ADD COLUMN "encaminhada_em" timestamp;--> statement-breakpoint
ALTER TABLE "ocorrencia" ADD CONSTRAINT "ocorrencia_encaminhada_por_id_user_id_fk" FOREIGN KEY ("encaminhada_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;