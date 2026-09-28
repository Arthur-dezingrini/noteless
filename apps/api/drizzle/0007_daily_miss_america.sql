CREATE TABLE "ocorrencia_audio" (
	"ocorrencia_id" text PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"dados" "bytea" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consulta" ALTER COLUMN "animal_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "animal" ADD COLUMN "numero" text;--> statement-breakpoint
ALTER TABLE "animal" ADD COLUMN "microchip" text;--> statement-breakpoint
ALTER TABLE "animal" ADD COLUMN "local" text;--> statement-breakpoint
ALTER TABLE "consulta" ADD COLUMN "grupo_id" text;--> statement-breakpoint
ALTER TABLE "grupo" ADD COLUMN "especie" text;--> statement-breakpoint
ALTER TABLE "grupo" ADD COLUMN "local" text;--> statement-breakpoint
ALTER TABLE "ocorrencia_audio" ADD CONSTRAINT "ocorrencia_audio_ocorrencia_id_ocorrencia_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "public"."ocorrencia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_grupo_id_grupo_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Toda consulta tem um alvo: um animal ou um grupo.
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_tem_alvo" CHECK ("animal_id" IS NOT NULL OR "grupo_id" IS NOT NULL);
