CREATE TABLE "aceite_termos" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"versao" text NOT NULL,
	"aceito_em" timestamp DEFAULT now() NOT NULL,
	"ip" text
);
--> statement-breakpoint
ALTER TABLE "ocorrencia" ADD COLUMN "audio_apagado_em" timestamp;--> statement-breakpoint
ALTER TABLE "aceite_termos" ADD CONSTRAINT "aceite_termos_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aceite_termos_user_versao_uq" ON "aceite_termos" USING btree ("user_id","versao");