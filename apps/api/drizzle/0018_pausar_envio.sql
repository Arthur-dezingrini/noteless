-- A coluna já entrou na homologação como 0017, antes de a 0016 dos termos
-- chegar à main: IF NOT EXISTS deixa a migração passar lá sem erro.
ALTER TABLE "gravador" ADD COLUMN IF NOT EXISTS "envio_pausado" boolean DEFAULT false NOT NULL;