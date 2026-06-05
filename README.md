# Vehicle Listing Tracker

A personal-use tool that tracks vehicle listings across Facebook Marketplace,
AutoTrader, and CarGurus. It solves one problem: when re-checking these sites
weekly, I can't remember which listings I've already seen — so the tool
remembers for me. A Chrome extension captures listing cards as I browse
normally and stores them in Supabase; a Next.js dashboard shows them with a
new → viewed / shortlisted / hidden workflow and a "new since last visit" view.

## Architecture

- **`extension/`** — plain-JS Chrome extension (Manifest V3, no build step). A
  content script parses listing cards from the DOM on supported search pages and
  batches them to Supabase via one Postgres RPC (`upsert_listings`).
- **`supabase/`** — the entire backend. `schema.sql` defines the tables and the
  `upsert_listings` function (dedupe, `last_seen` bump, price-change logging).
  No custom server.
- **`dashboard/`** — Next.js app that reads from Supabase with
  `@supabase/supabase-js`.

Single user, no auth, RLS intentionally disabled.

## Setup on a fresh machine

### 1. Supabase
1. Create a Supabase project.
2. In the SQL Editor, paste and run `supabase/schema.sql`.
3. Grab the project **URL** and **anon key** from Project Settings → API.

### 2. Extension
1. `cp extension/config.example.js extension/config.js`
2. Edit `extension/config.js` and fill in `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` (these stay local — `config.js` is gitignored).
3. Go to `chrome://extensions`, enable **Developer mode**, click
   **Load unpacked**, and select the `extension/` folder.

### 3. Dashboard
1. `cp dashboard/.env.local.example dashboard/.env.local`
2. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. `cd dashboard && npm install && npm run dev`

## Secrets

Never commit real credentials. `extension/config.js` and
`dashboard/.env.local` are gitignored; their `*.example` counterparts are
committed with placeholder values (`YOUR_SUPABASE_URL`,
`YOUR_SUPABASE_ANON_KEY`).
