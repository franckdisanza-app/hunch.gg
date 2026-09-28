# Deploy

Manual steps to get Plimp running on Vercel with Supabase, then on plimp.lol. Do them in order.
Every variable is described in `.env.example`.

## 0. Before you start

- Accounts: GitHub (you have it), [Supabase](https://supabase.com), [Vercel](https://vercel.com).
  The free plans of both are enough to start; see the notes on Hobby limits below.
- Generate two long random secrets, one for `IP_HASH_SALT` and one for `CRON_SECRET`:

  ```bash
  node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
  ```

## 1. Supabase: create the project and push the migrations

Pick one of the two ways.

### A. Directly on supabase.com (recommended)

1. Supabase dashboard → **New project**. Name it `plimp`, choose a region close to your players
   (a Central EU region for Switzerland), set a database password and keep it somewhere safe.
2. In this repository, link the CLI (installed as a dev dependency) and push the migrations:

   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <project-ref>
   pnpm exec supabase db push
   ```

   `<project-ref>` is the ID in the project URL (`https://<project-ref>.supabase.co`). `link` asks
   for the database password. `db push` applies `supabase/migrations/` only; the fake
   `seed.sql` is never pushed.

3. Dashboard → **Settings → API Keys**: create a **secret key** (`sb_secret_…`) and copy it, and
   copy the project URL. These become `SUPABASE_SECRET_KEY` and `SUPABASE_URL`.
4. Check: Dashboard → **Table Editor** shows `votes`, `guesses`, `reports`, `poll_snapshots` and
   `rate_limits`, each with RLS enabled and no policies. That is intended: only the server, with
   the secret key, can read or write.

### B. Through the Vercel Marketplace

In the Vercel project (step 2) → **Storage → Create Database → Supabase**. Vercel creates the
Supabase project and syncs `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (plus variables Plimp does
not use) into the Vercel project. Then run step A.2 against that project to push the migrations.

## 2. Vercel: create the project from GitHub

1. Vercel dashboard → **Add New → Project** → import `franckdisanza-app/hunch.gg` (allow the
   Vercel GitHub app to access the repository if asked).
2. Vercel detects Next.js and pnpm (from `pnpm-lock.yaml`). Keep the defaults: the build command
   runs `pnpm build`, which validates content first. Node.js 24 comes from `engines` in
   `package.json`.
3. Do not deploy yet: add the environment variables first (step 3), then deploy.

## 3. Environment variables

Vercel → Project → **Settings → Environment Variables**:

| Variable                         | Production   | Preview        | Notes                                                                                   |
| -------------------------------- | ------------ | -------------- | --------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                   | yes          | no             | From step 1.                                                                            |
| `SUPABASE_SECRET_KEY`            | yes          | no             | From step 1. Mark as sensitive.                                                         |
| `CROWD_STORE`                    | –            | `memory`       | Previews use the in-memory crowd store, so they never write to the production database. |
| `IP_HASH_SALT`                   | yes          | yes            | Random secret from step 0.                                                              |
| `CRON_SECRET`                    | yes          | –              | Random secret from step 0. Vercel Cron sends it automatically.                          |
| `CONTENT_MODE`                   | `production` | –              | Rejects `sample: true` content in production builds.                                    |
| `ENABLE_DEV_ROUTES`              | –            | `1` (optional) | Shows `/dev` and hidden games on previews. Never on Production.                         |
| `NEXT_PUBLIC_SITE_URL`           | after step 5 | –              | Leave unset until the domain works; it falls back to the Vercel URL.                    |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER` | optional     | –              | `none` by default. See "Analytics" below.                                               |

Then **Deployments → Redeploy** (or push to `main`). Variables apply to new deployments only.

## 4. Check the deployment

- `https://<project>.vercel.app/` shows the shelf ("The first game is coming soon").
- `https://<project>.vercel.app/api/health` answers `{"ok":true,"store":"supabase"}`.
- The cron route rejects requests without the secret and runs with it:

  ```bash
  curl -i https://<project>.vercel.app/api/cron/freeze
  curl -H "Authorization: Bearer <CRON_SECRET>" https://<project>.vercel.app/api/cron/freeze
  ```

  The first answers 401, the second `{"frozen":0}`.

- **Settings → Cron Jobs** lists `/api/cron/freeze` at `30 0 * * *`. Vercel runs crons on
  production deployments only. On the Hobby plan a daily job may run anywhere within that hour
  (00:30–01:29 UTC); Pro runs it on the minute.
- Every pull request gets a preview deployment; GitHub Actions CI runs on every PR as well.

## 5. Add the domain plimp.lol

1. Vercel → Project → **Settings → Domains** → add `plimp.lol` and `www.plimp.lol`; let Vercel
   redirect `www` to the apex.
2. At the registrar, set the DNS records Vercel shows for each domain (or switch the domain's
   nameservers to Vercel). Wait until Vercel shows both as valid; HTTPS is issued automatically.
3. Set `NEXT_PUBLIC_SITE_URL=https://plimp.lol` for Production and redeploy. Share links,
   canonical URLs, Open Graph images and the sitemap switch over with no code change.
4. If an analytics provider is set up, register `plimp.lol` there too.

## Analytics (optional)

All four providers are cookieless, so no cookie banner is needed. The script loads only on
production deployments.

| `NEXT_PUBLIC_ANALYTICS_PROVIDER` | Needs                                                                                           | Notes                                                                                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `none`                           | –                                                                                               | Default.                                                                                                                                                 |
| `plausible`                      | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (+ `…_SCRIPT_URL` if Plausible gives you a site-specific script) | Paid cloud service or self-hosted.                                                                                                                       |
| `umami`                          | `NEXT_PUBLIC_UMAMI_WEBSITE_ID` (+ script/host URLs if self-hosted)                              | Umami Cloud or self-hosted.                                                                                                                              |
| `vercel`                         | Enable **Analytics** in the Vercel project                                                      | Hobby plan: page views only, no custom events. Pro: custom events with 2 properties each (Plimp's `game_complete` sends 4); Web Analytics Plus allows 8. |

Check each service's current pricing before choosing; adding a paid service is your call.

## 6. Recommended GitHub settings

- **Settings → Branches → Add rule** for `main`: require a pull request and the CI checks
  ("Lint, typecheck, unit tests, content", "pnpm new-game output typechecks and lints",
  "Build, bundle budget, e2e, Lighthouse").

## Local development with Supabase (optional)

The app runs locally without a database: put `CROWD_STORE=memory` in `.env.local`. To run the
real database locally you need Docker Desktop, then:

```bash
pnpm db:start
pnpm db:reset
pnpm db:types
```

`db:start` prints a local API URL and keys: use them as `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
in `.env.local` (and remove `CROWD_STORE`). `db:reset` applies the migrations and the fake seed.
`db:types` regenerates `src/lib/supabase/types.ts`; commit it with the migration.
