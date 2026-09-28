# Plimp

Small daily browser games at [plimp.lol](https://plimp.lol). Each game asks for a gut guess about
something true, then reveals the sourced answer. A daily round takes a few minutes on a phone, and
every game also has an unlimited mode. No accounts, no ads, no cookies.

## Quick start

Requirements: Node.js 24 and pnpm 10.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Set `CROWD_STORE=memory` in `.env.local` to use the crowd API without a database. Open
http://localhost:3000 for the shelf and http://localhost:3000/dev for the component gallery.

## Commands

```bash
pnpm dev                 # development server
pnpm build               # validate content, then build
pnpm lint                # ESLint + Prettier
pnpm typecheck           # route types + TypeScript
pnpm test                # unit, component, API and SQL tests
pnpm test:e2e            # Playwright + axe against a production build
pnpm content:validate    # check every game's content and sources
pnpm new-game <slug> --name "<Name>" --engine <choice|estimate|clue|map>
```

## Stack

Next.js 16 (App Router, TypeScript strict), Tailwind CSS 4, Supabase (Postgres, server-side only),
Zod (`zod/mini`), Vitest, Playwright with axe, GitHub Actions, Vercel.

## Docs

- [CLAUDE.md](CLAUDE.md): conventions, house rules, planned games
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the frame, games, APIs and Supabase fit together
- [docs/ADDING_A_GAME.md](docs/ADDING_A_GAME.md): from `pnpm new-game` to live
- [docs/DEPLOY.md](docs/DEPLOY.md): Supabase, Vercel, environment variables, domain
