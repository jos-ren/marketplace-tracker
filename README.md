# Vehicle Listing Tracker

Tracks car listings across Facebook Marketplace, Kijiji, AutoTrader,
CarGurus, and Craigslist so you can tell what's new week to week. A Chrome
extension captures listings into Supabase as you browse; a Next.js dashboard
shows them in one place with a "new since last visit" view, price-drop
detection, and a save workflow.

<img width="1439" height="781" alt="image" src="https://github.com/user-attachments/assets/77b300b2-ade4-4e1e-b57d-9112a975826a" />

## Features

- **New since last visit** — only what's appeared since you last looked.
- **Save workflow** — star listings into a Saved tab (New / All / Saved).
- **Price tracking** — per-listing history; flags `↓ was $X` on a drop.
- **Cross-post dedupe** — the same car on multiple sites becomes one card.
- **"Possibly sold"** — flags listings not seen recently.

## Architecture

No custom backend server — the extension and dashboard both talk to Supabase
directly.

- **`extension/`** — plain-JS Chrome extension (Manifest V3, no build step). A
  content script parses listing cards from the DOM on supported search pages and
  batches them to Supabase via one Postgres RPC (`upsert_listings`).
- **`supabase/`** — the entire backend. `schema.sql` defines the tables and the
  `upsert_listings` function (dedupe, `last_seen` bump, price-change logging).
- **`dashboard/`** — Next.js 16 / React 19 / Tailwind v4 app that reads from
  Supabase with `@supabase/supabase-js`.

Single user, no auth, RLS disabled — built to run locally for one person.

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

## Notes

A personal project shared for reference — not packaged for distribution and not
actively accepting contributions. Feel free to fork it.
