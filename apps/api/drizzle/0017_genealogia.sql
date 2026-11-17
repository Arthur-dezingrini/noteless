ALTER TABLE "animal" ADD COLUMN "mae_id" text;--> statement-breakpoint
ALTER TABLE "animal" ADD COLUMN "pai_id" text;--> statement-breakpoint
ALTER TABLE "animal" ADD COLUMN "pai_externo" text;--> statement-breakpoint
ALTER TABLE "parto" ADD COLUMN "pai_id" text;--> statement-breakpoint
ALTER TABLE "parto" ADD COLUMN "pai_externo" text;--> statement-breakpoint
ALTER TABLE "animal" ADD CONSTRAINT "animal_mae_id_animal_id_fk" FOREIGN KEY ("mae_id") REFERENCES "public"."animal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal" ADD CONSTRAINT "animal_pai_id_animal_id_fk" FOREIGN KEY ("pai_id") REFERENCES "public"."animal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parto" ADD CONSTRAINT "parto_pai_id_animal_id_fk" FOREIGN KEY ("pai_id") REFERENCES "public"."animal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "animal_mae_id_idx" ON "animal" USING btree ("mae_id");--> statement-breakpoint
CREATE INDEX "animal_pai_id_idx" ON "animal" USING btree ("pai_id");