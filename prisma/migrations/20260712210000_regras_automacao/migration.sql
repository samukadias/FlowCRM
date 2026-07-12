-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "stage" "Stage",
    "diasLimite" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- Regra padrão, equivalente ao limiar fixo de 10 dias / qualquer etapa que
-- existia antes desta migração — preserva o comportamento atual do alerta.
INSERT INTO "AutomationRule" ("id", "nome", "stage", "diasLimite", "ativo", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Alerta padrão de estagnação', NULL, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
