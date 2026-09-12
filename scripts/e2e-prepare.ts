import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const DEFAULT_TEST_URL = "postgresql://vihe:vihe@localhost:5432/vihe_app_test?schema=public";

function testDatabaseUrl(): URL {
  return new URL(process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_URL);
}

function databaseName(url: URL): string {
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Refusing to create database with unsafe name: ${name}`);
  }
  return name;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status ?? "unknown"}`);
  }
}

async function ensureDatabase(testUrl: URL) {
  const name = databaseName(testUrl);
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";

  const prisma = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  try {
    const existing = await prisma.$queryRawUnsafe<Array<{ exists: number }>>(
      `SELECT 1 AS exists FROM pg_database WHERE datname = '${name}'`,
    );
    if (existing.length === 0) {
      await prisma.$executeRawUnsafe(`CREATE DATABASE ${name}`);
      console.log(`Created database ${name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const testUrl = testDatabaseUrl();
  await ensureDatabase(testUrl);

  const env = { ...process.env, DATABASE_URL: testUrl.toString() };
  run("npx", ["prisma", "migrate", "deploy"], env);
  run("npx", ["tsx", "prisma/seed.ts"], env);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
