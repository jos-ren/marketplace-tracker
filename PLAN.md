# Vehicle Listing Tracker — Implementation Plan

> **Instructions for Claude Code:** This document is the single source of truth for this project. Work through the phases in order. Each phase has tasks with checkboxes — check them off as completed (edit this file directly). Do not start a phase until the previous phase's acceptance criteria pass. Some steps are marked **[HUMAN]** — these require me (the user) to do something manually (browse a site, paste a key, load an extension); stop and ask me when you reach one. Do not build anything in the "Out of scope" list, even if it seems like an obvious improvement.

---

## 1. Project context

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
  posted_date: "YYYY-MM-DD string or null (site's listing date; added post-plan — only Craigslist exposes it on search cards)"
}
```

---

## 2. Phase 0 — Repo scaffolding & config plumbing

**Goal:** Folder structure exists, config/secret plumbing works, schema is verified live.

- [x] Create the folder structure above (empty files where content comes later)
- [x] Write `.gitignore`: `extension/config.js`, `dashboard/.env.local`, `node_modules/`, `.next/`
- [x] Write `extension/config.example.js` exporting `SUPABASE_URL` and `SUPABASE_ANON_KEY` placeholders
- [x] Write `README.md`: one-paragraph description, setup steps for a fresh machine (copy example configs, fill in keys, load unpacked extension, run dashboard)
- [x] **[HUMAN]** Copy `config.example.js` → `config.js` and fill in real Supabase values
- [x] **[HUMAN]** Confirm schema is applied: run the test upsert in Supabase SQL editor (`select upsert_listings('[{"source":"facebook","external_id":"test123","url":"https://example.com","title":"2018 Toyota Tacoma","price":"24500"}]'::jsonb);`) — should return 1 the first time, 0 the second

**Acceptance criteria:** Repo tree matches the structure; `git status` shows no secret files; test row visible in Supabase Table Editor.

---

## 3. Phase 1 — Extension skeleton + Supabase wiring

**Goal:** A loadable extension that, on any supported site, can send a hardcoded fake listing to Supabase and confirm it lands. Prove the pipe before building parsers.

- [x] `manifest.json` (Manifest V3):
  - `content_scripts` matching only: `https://www.facebook.com/marketplace/*`, `https://www.autotrader.com/*`, `https://www.cargurus.com/*`
  - Inject order: `config.js`, `lib/supabase.js`, `lib/queue.js`, `parsers/*.js`, `content.js` (plain scripts, no modules — MV3 content scripts and ES modules don't mix without a bundler, which we're not using)
  - `host_permissions` for the Supabase project URL pattern (`https://*.supabase.co/*`)
  - No `background` service worker in v1 — content scripts can `fetch` directly
  - Minimal permissions: no `tabs`, no `storage`, no `<all_urls>`
- [x] `lib/supabase.js`: `sendListings(items)` — a `fetch` POST to `{SUPABASE_URL}/rest/v1/rpc/upsert_listings` with headers `apikey` and `Authorization: Bearer {anon key}`, body `{ items }`. Returns the inserted count. Log failures to console with a recognizable prefix like `[vt]`.
- [x] `lib/queue.js`: 
  - In-memory `Set` of `source:external_id` already sent this page session
  - `enqueue(listing)` — skips if already in Set, otherwise adds to a pending array
  - Flush logic: send pending batch when it reaches 10 items OR 2 seconds after the last enqueue (debounced), whichever first
- [x] `content.js`: detect which site we're on from `location.hostname`, log `[vt] active on <site>`, and (temporarily) call `sendListings` with one fake listing to prove the pipe
- [x] **[HUMAN]** Load unpacked extension, open Facebook Marketplace, check DevTools console for `[vt]` logs, check Supabase Table Editor for the fake row
- [x] Remove the fake-listing test call once confirmed

**Acceptance criteria:** Extension loads with no manifest errors; fake listing appears in Supabase from a real browsing session; no CORS errors (Supabase allows browser origins by default — if errors appear, diagnose before proceeding).

**Notes for Claude Code:** You cannot load the extension or browse Facebook yourself — when DOM/console verification is needed, give me exact step-by-step instructions and exactly what output to paste back to you.

---

## 4. Phase 2 — Parsers (the core work)

**Goal:** Real listings flow into Supabase from all three sites during normal browsing.

**Shared parser contract:** each `parsers/<site>.js` defines a global object, e.g. `window.vtParsers.facebook = { matches(hostname), findCards(rootNode), parseCard(cardEl) }`. `parseCard` returns a listing object (shape above) or `null` if the card is unparseable. `content.js` wires the active parser to a `MutationObserver`.

**Build and verify ONE SITE AT A TIME, in this order** (easiest → hardest):

### 2a. AutoTrader
- [x] Identify card elements on search results pages — `article[data-testid="list-item"]`; anchor on stable `data-*` attrs, not hashed CSS-module classes
- [x] Extract: listing ID from the card's detail link, price, title (year/make/model parse from title), mileage, photo
- [x] **[HUMAN]** Browse an AutoTrader search, paste back: a sample card's `outerHTML` (Claude Code: ask for this BEFORE writing selectors — write parsers against real HTML I provide, not guessed selectors)
- [x] **[HUMAN]** Verify rows in Supabase match what's on screen (spot-check 5 listings: price, title, ID correct)

### 2b. CarGurus
- [x] Same flow: **[HUMAN]** provides sample card HTML first, then write parser (cargurus.ca; anchors on `[data-testid="srp-listing-tile"]` + the hidden per-tile `<dl>` for year/make/model/mileage)
- [x] **[HUMAN]** Verify 5 listings in Supabase

### 2c. Facebook Marketplace (hardest — budget the most iteration here)
- [x] **Never select by class name** — FB classes are obfuscated and rotate. Anchor on structure: `a[href*="/marketplace/item/"]` anchors are the cards; regex the ID from the href (`/marketplace/item/(\d+)/`)
- [x] Extract price/title/location from text nodes inside the anchor (price is typically the line matching `/^\$[\d,]+/`; the title line follows; location/mileage lines after). Write this defensively — return partial objects rather than null when some fields fail
- [x] Strip URL query params before storing `url`; keep it canonical: `https://www.facebook.com/marketplace/item/{id}/`
- [x] **[HUMAN]** provides sample card HTML first; expect 2–3 rounds of selector fixes (round 1 provided)
- [x] Handle infinite scroll: confirm MutationObserver + debounce keeps capturing as I scroll
- [x] **[HUMAN]** Verify 5 listings in Supabase

### 2e. Craigslist *(added post-plan at user request, 2026-06-04)*
- [x] **[HUMAN]** Confirm the city subdomain in use — `vancouver.craigslist.org` (matched broadly via `https://*.craigslist.org/*`)
- [x] **[HUMAN]** Browse a Craigslist cars+trucks search, paste back a sample card's `outerHTML` (real HTML before selectors) — gallery view
- [x] Add manifest match + `vtDetectSite` entry; write `parsers/craigslist.js`
- [x] **[HUMAN]** Verify 5 listings in Supabase (incl. `posted_date` populated)

### 2f. Kijiji *(added post-plan at user request, 2026-06-04)*
- [x] **[HUMAN]** Browse a Kijiji cars+vehicles search, paste back a sample card's `outerHTML` (sample was an engine-part listing — same structure; needs car-listing verification)
- [x] Add manifest match + `vtDetectSite` entry; write `parsers/kijiji.js`
- [ ] **[HUMAN]** Verify 5 listings in Supabase (esp. **mileage** on real car listings — selector is best-effort/unverified)

### 2d. Hardening (all sites)
- [x] Guard against duplicate sends within a session (queue Set) — `lib/queue.js` `vtSentKeys`; confirmed via repeated scrolling during per-site tests (no row inflation)
- [x] Price parsing: strip `$`, commas; handle "$24,500" and edge cases like missing price → null — all parsers via `digitsOrNull`/`intOrNull` (e.g. Kijiji "Please Contact" → null)
- [x] Mileage parsing: "45K miles" → 45000; "45,000 mi" → 45000 — `parseMileage` (FB/Craigslist) handles K + km/mi; AutoTrader/CarGurus use clean numeric sources; Kijiji scans "N km"
- [x] Year extraction: first 4-digit number 1950–2030 in the title — shared `/\b(19[5-9]\d|20[0-3]\d)\b/`
- [x] All parsers wrapped in try/catch per card — `content.js` `vtScan` try/catches `parseCard` per card and `findCards` overall; one bad card can't kill the loop

**Acceptance criteria:** A normal 10-minute browsing session across all three sites produces correct rows in Supabase with no console errors; re-browsing the same results does not create duplicates; a price edit on a re-seen listing creates a `price_history` row (verify by re-running the SQL test with a changed price).

---

## 5. Phase 3 — Dashboard

**Goal:** One-page Next.js app showing my listings with the status workflow and "new since last visit."

- [x] **[HUMAN]** Run `npx create-next-app@latest dashboard …`, `npm install @supabase/supabase-js` — scaffold already present (Next 16.2.7, React 19, Tailwind v4, TS); `@supabase/supabase-js` already a dependency
- [x] `dashboard/.env.local.example` with `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` placeholders (added `!.env.local.example` exception to dashboard `.gitignore`); **[HUMAN]** creates real `.env.local`
- [x] `lib/supabase.ts`: client singleton (`getSupabase()` returns null if env missing → UI shows config message instead of crashing)
- [x] Main page (client component) with:
  - [x] **Tabs:** New | All | Shortlist | Hidden. "New" = `status = 'new'` AND `first_seen > last_dashboard_visit`; "All" excludes hidden
  - [x] **Listing card grid** (responsive, 1/2/3 cols): photo (placeholder if null), title, price, mileage, location, source badge, "first seen N days ago", link out (new tab)
  - [x] **Price-drop badge:** one `price_history` query, grouped client-side to last-two prices; if latest < previous, "⬇ was $X"
  - [x] **Stale indicator:** `last_seen` > 14 days → muted "possibly sold" tag
  - [x] **Status buttons per card:** Viewed ✓ / Shortlist ★ / Hide ✕ — single `update` each, optimistic local state
  - [x] **Filters bar:** max price, max km, text search on title/make_model (client-side)
  - [x] **Last-visit logic:** read `app_state.last_dashboard_visit` FIRST, compute New against it, THEN stamp `now()` back
  - [x] Sort: New tab by `first_seen` desc; others by `last_seen` desc
- [x] Empty states for each tab ("Nothing new since your last visit 🎉")
- [x] Dark-mode friendly (Tailwind `dark:` utilities throughout)

**Acceptance criteria:** `npm run dev` → I can triage a real captured batch: mark viewed/shortlist/hide, see counts change, refresh and confirm persistence; close the tab, capture new listings via the extension, reopen → only the new ones appear in the New tab.

---

## 6. Phase 4 — Polish & quality-of-life

**Goal:** The small things that make daily use pleasant. Only start after a week of real use of Phases 1–3.

- [ ] Extension badge: show count of new listings inserted this session (requires adding a minimal background service worker + `chrome.action.setBadgeText`; keep it tiny)
- [ ] Dashboard: shortlist compare view — shortlisted cards side-by-side with price history sparkline (tiny inline SVG, no chart library)
- [ ] Dashboard: "mark all as viewed" button on the New tab
- [ ] Parser telemetry: a `[vt]` console summary per page ("captured 23, sent 18 new") to make breakage obvious
- [ ] Deploy dashboard to Vercel (root directory = `dashboard/`) — optional; local is fine
- [ ] Backlog (do NOT build unless I ask): auth + RLS, cron re-checks, Telegram alerts, cross-site fuzzy dedupe, fair-price scoring, VIN decoding

---

## 7. Working agreements for Claude Code

1. **Real HTML before selectors.** Never guess at a site's DOM. Ask me to paste a card's `outerHTML` and write parsers against it.
2. **One site at a time, verified end-to-end**, before moving to the next.
3. **Keep the extension boring.** Plain JS, no build step, no libraries. If you're tempted to add a bundler, don't.
4. **Stop at [HUMAN] steps** and tell me exactly what to do and what to paste back.
5. **Update this file's checkboxes** as tasks complete, and add a short "## Progress log" section at the bottom with dated entries (1–2 lines each) so we always know where we left off.
6. **Don't touch `supabase/schema.sql`** without flagging it — schema changes require me to re-run SQL manually, so call that out loudly and provide a migration snippet rather than editing the original file.
7. **Secrets stay placeholder** in every file you write and every message you output.

## Progress log

- **2026-06-04** — Phase 0: scaffolded `extension/` (manifest, content, lib/, parsers/ as empty placeholders), wrote root `.gitignore`, `extension/config.example.js` (placeholder consts), `README.md`, and root `CLAUDE.md` (Project context mirror). Verified secret paths are gitignored and absent from the tree. Dashboard already scaffolded via create-next-app in a prior step. Confirmed extension creds will stay in gitignored `config.js` (user chose this over a `.env`, since a no-build MV3 extension can't read `.env`).
- **2026-06-04** — Phase 0 closed. **[HUMAN]** applied `supabase/schema.sql` to the live project (it wasn't actually applied beforehand) with RLS intentionally left disabled, and created `extension/config.js` with real creds. Test upsert returned `1` then `0` → insert + dedupe verified. Acceptance criteria met.
- **2026-06-04** — Phase 1 code written: `manifest.json` (MV3, content scripts on the 3 sites, `https://*.supabase.co/*` host permission, no background/storage/tabs), `lib/supabase.js` (`sendListings` → `upsert_listings` RPC, returns insert count, never throws), `lib/queue.js` (session dedupe Set + 10-item / 2s debounced flush), `content.js` (site detect + temporary fake-listing pipe test). Validated JSON + JS syntax.
- **2026-06-04** — Phase 1 **closed**. **[HUMAN]** loaded unpacked on Facebook Marketplace: console showed `[vt] active on facebook` + `[vt] flushed 1 listing(s) → 1 new`, no CORS errors, `pipe-test-facebook` row landed in Supabase. Pipe proven. Removed the temporary fake-listing block from `content.js` (now just site-detect + a Phase 2 placeholder). Acceptance criteria met.
- **2026-06-04** — Phase 2a (AutoTrader) parser written against real card HTML. **Discovery: user is on autotrader.`ca`, not `.com`** — different DOM (autoscout24-based). Updated manifest match to `https://www.autotrader.ca/*` and made `vtDetectSite` substring-based. Parser anchors on stable `data-*` attrs on `article[data-testid="list-item"]` (`data-guid`, `data-price`, `data-mileage`, `data-model-year`, `data-make/model`). **Mileage is KM on .ca — stored as raw odometer number, not converted.** Wired `content.js` to scan + debounced MutationObserver for infinite scroll. Hand-traced all 10 fields against the sample card; awaiting **[HUMAN]** Supabase spot-check.
- **2026-06-04** — Phase 2a (AutoTrader) **closed**. First pass had `location` null (class-based seller wrapper only matched private-seller cards, not dealers). Reworked location to a content-based scan: iterate the card's spans for a "City, PROV" match (Canadian province codes), stripping the "• N km from you" distance. **[HUMAN]** verified all fields incl. location now populate; the `coalesce` upsert backfilled previously-null locations on re-browse.
- **2026-06-04** — Phase 2b (CarGurus) parser written against real card HTML — also `.ca`. Manifest match → `https://www.cargurus.ca/*`. Cards = `[data-testid="srp-listing-tile"]`; ID from `/details/<id>` link; price/mileage/location from `data-testid` hooks; year/make/model from the hidden per-tile `<dl>`. Mileage = KM, stored raw. Syntax validated; awaiting **[HUMAN]** Supabase spot-check.
- **2026-06-04** — Phase 2b (CarGurus) **closed**. **[HUMAN]** verified rows in Supabase look correct. Two of three sites done; next is Facebook Marketplace (2c, the hard one).
- **2026-06-04** — Phase 2c (Facebook) parser written, round 1. Anchor = `a[href*="/marketplace/item/"]`, ID via regex, canonical URL `…/item/{id}/`. Title (and backup price) from the anchor's `aria-label`; price/mileage/location classified from `span[dir="auto"]` text lines by PATTERN (`$`→price, `km|mi`→mileage, `, XX`→location) so it's order-independent. `parseMileage` handles "165K km" / "45,000 km" / "45K miles". Hand-traced the sample card OK. Awaiting **[HUMAN]** browse + infinite-scroll + Supabase check (plan budgets 2–3 rounds here).
- **2026-06-04** — Phase 2c (Facebook) **closed** in ONE round. **[HUMAN]** confirmed rows look good and infinite-scroll capture works. All three original sites done. User requested two additional sites: **Craigslist** then **Kijiji** (scope addition; added as sections 2e/2f). Proceeding one at a time, real-HTML-first, starting with Craigslist.
- **2026-06-04** — Phase 2e (Craigslist) parser written against real gallery-view card. Stable semantic classes (`.cl-search-result[data-pid]`, `.priceinfo`, `.posting-title`, `.result-location`). Odometer is a bare text node in `.meta` — scan only direct text nodes to avoid merging posted-date `6/2` with `371,000km`. Manifest match `https://*.craigslist.org/*` + `vtDetectSite`/inject-list updated. Validated; awaiting **[HUMAN]** Supabase check.
- **2026-06-04** — Added `posted_date` (user request). Only Craigslist exposes a date on search cards ("M/D", no year) — AutoTrader/CarGurus/FB don't, so they stay null. **SCHEMA CHANGE (flagged):** edited `supabase/schema.sql` (new `posted_date date` column + `upsert_listings` now reads/writes it). Live DB requires a manual migration (`ALTER TABLE` + `CREATE OR REPLACE FUNCTION`) — provided to **[HUMAN]**, awaiting run. Craigslist parser now emits `posted_date` (year inferred, rolls back if future). Updated listing-shape docs in CLAUDE.md + PLAN.
- **2026-06-04** — Phase 2e (Craigslist) **closed**. **[HUMAN]** ran the migration and verified rows incl. `posted_date`. Next: Kijiji.
- **2026-06-04** — Phase 2f (Kijiji) parser written. Stable `data-testid` hooks. `findCards` filters to automotive cards via presence of `[data-testid="autos-listing-price"]`, so we can match all of `www.kijiji.ca/*` without capturing non-vehicle listings. Date is RELATIVE ("2 wks ago") → `posted_date` approximated (days/wks/mos/yrs-ago math; dd/mm/yyyy fallback). **Caveat: the sample card was an engine PART** (no price/mileage/year-as-car) — mileage selector is a best-effort "N km" element scan, UNVERIFIED on real car listings. Manifest/detect/inject updated, validated. Awaiting **[HUMAN]** verification on actual car listings.
- **2026-06-04** — Phase 2f (Kijiji) **closed**. **[HUMAN]** provided a real vehicle card; traced + verified `mileage` (`196825 km`) and all fields populate. **All five sites done** (AutoTrader, CarGurus, Facebook, Craigslist, Kijiji — original 3 + 2 added). Phase 2d hardening reviewed and checked off — all items were satisfied by construction (queue dedupe Set, `digitsOrNull` price parsing, `parseMileage`, shared year regex, per-card try/catch in `content.js`). Phase 2 complete. Next: Phase 3 dashboard.
- **2026-06-04** — Phase 3 (Dashboard) built. Read Next 16.2.7 bundled docs first (per `dashboard/AGENTS.md`). Single client-component page (`app/page.tsx`) reading Supabase directly via `NEXT_PUBLIC_*`; `lib/{supabase,types,format}.ts` + `components/ListingCard.tsx`. Tabs (New/All/Shortlist/Hidden) with counts, responsive card grid, price-drop badge (one price_history query grouped client-side), stale "possibly sold" tag, optimistic status buttons, filters (max price/km, search), read-then-stamp last-visit logic, empty states, dark mode. Plain `<img>` (many CDN hosts) with inline eslint-disable. `npm run build` passes (TS clean). Code complete; awaiting **[HUMAN]** `.env.local` + `npm run dev` acceptance test.
- **2026-06-04** — Phase 3 (Dashboard) **closed**. **[HUMAN]** created `.env.local` and ran the app. Initial `401 Unauthorized` was a bad/mismatched anon key in `.env.local` (not RLS/code) — fixed by using the correct anon key + restarting dev. Dashboard now loads real listings. **Phases 0–3 complete.** Phase 4 is gated on "a week of real use" per the plan — natural stopping point.
- **2026-06-04** — Non-vehicle filtering (user request; e.g. a Craigslist "Honda Element OEM Exhaust" part got imported). User preferred a **content-based** heuristic over URL-category. Added `lib/vehicle.ts` `isVehicle()`: vehicle if it has mileage OR year, UNLESS the title matches a parts-keyword backstop (exhaust/engine/tires/…) AND has no mileage. Applied **non-destructively in the frontend** (parts stay in DB) — a `base` list gated by a "Show parts/non-vehicles" toggle (default hides them; shows an "(N hidden)" count), feeding both tab counts and the grid so "New" stays clean. Build passes.
- **2026-06-04** — Dashboard filters/sort enhancements (user requests): added **Min price** (alongside existing Max price), and a **Sort** dropdown — price (↑/↓), added date / first_seen (newest/oldest), posted date (newest/oldest), mileage (↑/↓), plus "Default" (per-tab: New→first_seen, others→last_seen). Nulls always sort to the end. Build passes.
- **2026-06-04** — Click/view tracking (user request). **SCHEMA CHANGE (flagged):** added `view_count int default 0` + `last_viewed_at` to `listings` and a `record_view(p_id uuid)` RPC (atomic `view_count+1`, stamps `last_viewed_at`, promotes new→viewed) in `supabase/schema.sql`. Live DB needs the migration (`ALTER TABLE` + `CREATE FUNCTION`) — provided to **[HUMAN]**. Dashboard: clicking a card's photo/title fires `recordView` (optimistic increment + new→viewed), a "👁 N" badge shows on viewed cards, and a "Most viewed" sort option added. Build passes.
- **2026-06-04** — Per user: **decoupled view tracking from status**. `record_view` RPC + dashboard `recordView` no longer promote new→viewed; clicking only bumps `view_count`/`last_viewed_at`. Updated `record_view` migration must be re-run (CREATE OR REPLACE) to drop the status change. Build passes.
- **2026-06-04** — Added "Show no-price listings" toggle (default off → listings with `price == null` hidden from grid + counts; "(N hidden)" indicator). Applied in the shared `base` list alongside the non-vehicle filter. Build passes.
- **2026-06-04** — Strengthened `isVehicle` with a **required brand gate** (user request). Added `VEHICLE_BRANDS` static list in `lib/vehicle.ts` — curated car/truck makes sold in Canada incl. used-market legacy (Pontiac/Saturn/Scion/Mercury/Suzuki/Hummer/Saab) + EV newcomers (Tesla/Rivian/Lucid/Polestar/Genesis) + aliases (chevy/vw/mercedes/range rover); pure moto brands excluded. Rule now: has-brand AND not(part-keyword & no mileage) AND (mileage or year). Word-boundary regex avoids substring false positives (e.g. "ram" in "frame"). Build passes.
- **2026-06-04** — Moved min/max price, max km, and both toggles into a **Filters dropdown** button (right of Sort). Search + Sort stay inline. Button shows an active-filter count badge, panel has a "Clear filters" link, closes on outside click. Build passes.
- **2026-06-04** — Cards now show the site **posted date** when present (`postedLabel`, e.g. "· posted 3 days ago"; exact date on hover). Only Craigslist/Kijiji rows have `posted_date`. Build passes.
- **2026-06-04** — **Cross-site dedupe** (was v1 backlog "do not build unless asked" — user asked). Client-side only. Listings combine into one card when they share **price + mileage + year** (only when price & mileage present; else solo). Exact title NOT used (cross-site titles differ). `ListingCard` refactored to take a `group: Listing[]` (rep = highest-sorted member): renders one **source badge per site** (each a link to its own listing + records that listing's view), an "On X + Y" line, summed view count, min first_seen, earliest posted_date, max last_seen for staleness; status buttons apply to all members. Grouping happens after filter/sort so order is preserved. Build passes.