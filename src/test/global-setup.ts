import { execSync } from "node:child_process";
import { config } from "dotenv";
import { Client } from "pg";

/**
 * Roda uma vez antes de toda a suíte: garante que o banco de teste existe
 * e está com as migrações em dia. Nunca toca no banco de desenvolvimento.
 */
export default async function setup() {
  config({ path: ".env.test", override: true });

  const url = new URL(process.env.DATABASE_URL!);
  const nomeBanco = url.pathname.slice(1);
  if (!nomeBanco.endsWith("_test")) {
    throw new Error(
      `DATABASE_URL de teste deve apontar para um banco "*_test" (recebi "${nomeBanco}") — proteção contra rodar os testes no banco de desenvolvimento.`,
    );
  }

  const urlAdmin = new URL(url);
  urlAdmin.pathname = "/postgres";
  const admin = new Client({ connectionString: urlAdmin.toString() });
  await admin.connect();
  const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
    nomeBanco,
  ]);
  if (rowCount === 0) {
    // Identificador de banco não aceita bind parameter — nome já validado acima
    await admin.query(`CREATE DATABASE "${nomeBanco}"`);
  }
  await admin.end();

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: "inherit",
  });
}
