#!/bin/sh
set -eu

npx prisma migrate deploy
npx tsx prisma/seed.ts
exec npx next start --hostname 0.0.0.0 --port "${PORT:-8080}"
