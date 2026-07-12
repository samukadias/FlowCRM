import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import path from "node:path";

config({ path: ".env.test", override: true });

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globalSetup: "./src/test/global-setup.ts",
    // Todos os arquivos de teste de integração compartilham o mesmo banco
    // Postgres real (propostaflow_test) e cada um limpa as tabelas no
    // beforeEach — rodar em paralelo causa corrida entre arquivos (um limpa
    // enquanto outro ainda tem uma transação em andamento).
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
      AUTH_SECRET: process.env.AUTH_SECRET!,
    },
  },
});
