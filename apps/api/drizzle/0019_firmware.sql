CREATE TABLE "firmware" (
	"versao" text PRIMARY KEY NOT NULL,
	"tamanho" integer NOT NULL,
	"sha256" text NOT NULL,
	"assinatura" text NOT NULL,
	"dados" "bytea" NOT NULL,
	"publicado_por_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gravador" ADD COLUMN "firmware_alvo" text;--> statement-breakpoint
ALTER TABLE "firmware" ADD CONSTRAINT "firmware_publicado_por_id_user_id_fk" FOREIGN KEY ("publicado_por_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gravador" ADD CONSTRAINT "gravador_firmware_alvo_firmware_versao_fk" FOREIGN KEY ("firmware_alvo") REFERENCES "public"."firmware"("versao") ON DELETE set null ON UPDATE no action;