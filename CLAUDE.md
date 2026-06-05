# Project context

> Source of truth for the full plan is `PLAN.md`. This file mirrors the
> "Project context" section so it's always loaded. Work through `PLAN.md`'s
> phases in order and follow its "Working agreements" strictly.

**What this is:** A personal-use tool that tracks vehicle listings across Facebook Marketplace, AutoTrader, and CarGurus. The core problem it solves: when re-checking these sites weekly, I can't remember which listings I've already seen. The tool remembers for me.

**How it works (architecture):**
1. A **Chrome extension** (plain JS, Manifest V3, loaded unpacked) runs on listing search pages. As I browse normally, a content script parses listing cards from the DOM and batches them to Supabase.
2. **Supabase** is the entire backend. No custom server. The extension calls one Postgres RPC function (`upsert_listings`) that dedupes, updates `last_seen`, and logs price changes. The schema already exists in `supabase/schema.sql` and has been applied to my Supabase project.
3. A **Next.js dashboard** reads from Supabase via `@supabase/supabase-js` and shows listings with status workflow: new → viewed / shortlisted / hidden. The killer feature is the "New since last visit" view, computed from a `last_dashboard_visit` timestamp in the `app_state` table.

**Key design constraints (do not change these):**
- Single user. No auth. RLS is intentionally disabled (Supabase will warn — ignore it).
- No backend server, no API routes that proxy Supabase. Extension and dashboard both talk to Supabase directly.
- Extension is plain JavaScript — no bundler, no framework, no build step. It must load via `chrome://extensions` → "Load unpacked" pointing at the `extension/` folder.
- No cron jobs, no notifications, no cross-site fuzzy dedupe in v1.
- Dedupe key is `(source, external_id)` — exact match only.

**Repo structure (already initialized, create folders as needed):**
```
vehicle-tracker/
  extension/            # plain JS Chrome extension
    manifest.json
    config.js           # Supabase URL + anon key (gitignored, with config.example.js committed)
    content.js          # entry: detects site, runs observer, batches sends
    lib/
      supabase.js       # thin fetch wrapper for the RPC call
      queue.js          # batching + in-session dedupe Set
    parsers/
      facebook.js
      autotrader.js
      cargurus.js
  dashboard/            # Next.js app (created via create-next-app)
  supabase/
    schema.sql          # already exists — applied to the live project
  PLAN.md               # this file — keep checkboxes updated
  README.md
  .gitignore
```

**Secrets handling:** Never commit real credentials. `extension/config.js` and `dashboard/.env.local` are gitignored. Commit `extension/config.example.js` and `dashboard/.env.local.example` with placeholder values (`YOUR_SUPABASE_URL`, `YOUR_SUPABASE_ANON_KEY`). In all code, docs, and chat output, refer to credentials only by placeholder.

**Listing data shape** (what parsers must produce per card — matching the RPC's expected jsonb):
```js
{
  source: "facebook" | "autotrader" | "cargurus",
  external_id: "string (site's listing ID, extracted from URL)",
  url: "absolute URL to the listing",
  title: "string or null",
  price: "integer (whole dollars) or null",
  year: "integer or null (parse from title when possible)",
  make_model: "string or null",
  mileage: "integer (miles) or null",
  location: "string or null",
  photo_url: "string or null",
  posted_date: "YYYY-MM-DD string or null (site's listing date; only Craigslist exposes it on search cards)"
}
```
