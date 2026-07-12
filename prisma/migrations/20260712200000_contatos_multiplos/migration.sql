-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_clienteId_idx" ON "Contact"("clienteId");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing single "contato principal" fields on Cliente into Contact rows
INSERT INTO "Contact" ("id", "clienteId", "nome", "email", "telefone", "principal", "createdAt")
SELECT gen_random_uuid()::text, "id", "contatoNome", "contatoEmail", "contatoTelefone", true, CURRENT_TIMESTAMP
FROM "Cliente"
WHERE "contatoNome" IS NOT NULL;

-- AlterTable
ALTER TABLE "Cliente" DROP COLUMN "contatoNome",
DROP COLUMN "contatoEmail",
DROP COLUMN "contatoTelefone";
