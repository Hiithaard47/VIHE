<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Feature modules

Domain code lives under `src/modules/<domain>/{ui,service,db}` (pilot: `session-homework`). App Router pages in `src/app` stay thin and compose module UI / actions.

| Layer | Role | Must not |
|-------|------|----------|
| `db/` | Prisma queries/mutations | React, redirect, rbac, FormData |
| `service/` | Business rules; throw domain errors | React, `next/navigation` |
| `ui/` | React components | `@/lib/prisma` / direct Prisma |
| `actions.ts` | FormData → service → revalidate/redirect | Business rules or raw Prisma |

Shared cross-cutting helpers stay in `src/lib` (`prisma`, `rbac`, `storage`, `flash`, href helpers). Prefer extending an existing module over adding Prisma calls in pages or components.
