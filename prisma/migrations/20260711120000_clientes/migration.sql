-- Cadastro de clientes (nome + sigla) preservando os dados existentes

CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Cliente_nome_key" ON "Cliente"("nome");
CREATE UNIQUE INDEX "Cliente_sigla_key" ON "Cliente"("sigla");

-- Backfill: um cliente para cada nome já usado nas propostas;
-- sigla provisória = primeira palavra do nome, em maiúsculas
INSERT INTO "Cliente" ("id", "nome", "sigla")
SELECT md5(random()::text || clock_timestamp()::text || t."cliente"),
       t."cliente",
       upper(regexp_replace(split_part(t."cliente", ' ', 1), '[^A-Za-z0-9]', '', 'g'))
FROM (SELECT DISTINCT "cliente" FROM "Opportunity") t;

ALTER TABLE "Opportunity" ADD COLUMN "clienteId" TEXT;

UPDATE "Opportunity" o
SET "clienteId" = c."id"
FROM "Cliente" c
WHERE o."cliente" = c."nome";

ALTER TABLE "Opportunity" ALTER COLUMN "clienteId" SET NOT NULL;
ALTER TABLE "Opportunity" DROP COLUMN "cliente";

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
