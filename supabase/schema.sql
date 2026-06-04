-- ============================================================
-- Vehicle Listing Tracker — Supabase schema (MVP v1)
-- Paste this whole file into the Supabase SQL Editor and run it.
-- ============================================================

-- ---------- TABLES ----------

create table listings (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,              -- 'facebook' | 'autotrader' | 'cargurus'
  external_id  text not null,              -- the listing ID from the site's URL
  url          text not null,
  title        text,
  price        integer,                    -- whole dollars, null if not parsed
  year         integer,
  make_model   text,                       -- e.g. 'Toyota Tacoma' (split later if needed)
  mileage      integer,                    -- in miles
  location     text,
  photo_url    text,
  status       text not null default 'new',-- 'new' | 'viewed' | 'shortlisted' | 'hidden'
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),

  -- THE dedupe rule: one row per listing per site
  unique (source, external_id)
);

create table price_history (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references listings(id) on delete cascade,
  price        integer not null,
  observed_at  timestamptz not null default now()
);

-- one-row-per-key settings store (e.g. last_dashboard_visit)
create table app_state (
  key    text primary key,
  value  text
);

-- ---------- INDEXES ----------

create index listings_status_idx     on listings (status);
create index listings_first_seen_idx on listings (first_seen desc);
create index listings_last_seen_idx  on listings (last_seen desc);
create index price_history_listing_idx on price_history (listing_id, observed_at desc);

-- ---------- SEED ----------

insert into app_state (key, value)
values ('last_dashboard_visit', now()::text);

-- ---------- THE ONE PIECE OF BACKEND LOGIC ----------
-- The extension calls this via:
--   POST /rest/v1/rpc/upsert_listings
--   body: { "items": [ {source, external_id, url, title, price, ...}, ... ] }
--
-- For each listing:
--   * never seen before  -> insert it (status 'new') + first price_history row
--   * seen before        -> bump last_seen, refresh fields,
--                           and if the price changed, log it to price_history

create or replace function upsert_listings(items jsonb)
returns integer  -- number of NEW listings inserted (handy for the extension badge)
language plpgsql
set search_path = public
as $$
declare
  item       jsonb;
  existing   listings%rowtype;
  new_price  integer;
  inserted_count integer := 0;
begin
  for item in select * from jsonb_array_elements(items)
  loop
    -- skip malformed entries defensively
    if item->>'source' is null or item->>'external_id' is null then
      continue;
    end if;

    new_price := nullif(item->>'price', '')::integer;

    select * into existing
    from listings
    where source = item->>'source'
      and external_id = item->>'external_id';

    if not found then
      insert into listings
        (source, external_id, url, title, price, year, make_model,
         mileage, location, photo_url)
      values
        (item->>'source',
         item->>'external_id',
         coalesce(item->>'url', ''),
         item->>'title',
         new_price,
         nullif(item->>'year', '')::integer,
         item->>'make_model',
         nullif(item->>'mileage', '')::integer,
         item->>'location',
         item->>'photo_url')
      returning * into existing;

      inserted_count := inserted_count + 1;

      if new_price is not null then
        insert into price_history (listing_id, price)
        values (existing.id, new_price);
      end if;

    else
      update listings set
        last_seen  = now(),
        url        = coalesce(nullif(item->>'url', ''), url),
        title      = coalesce(item->>'title', title),
        photo_url  = coalesce(item->>'photo_url', photo_url),
        location   = coalesce(item->>'location', location),
        year       = coalesce(nullif(item->>'year', '')::integer, year),
        make_model = coalesce(item->>'make_model', make_model),
        mileage    = coalesce(nullif(item->>'mileage', '')::integer, mileage),
        price      = coalesce(new_price, price)
      where id = existing.id;

      -- price changed? log it
      if new_price is not null
         and existing.price is distinct from new_price then
        insert into price_history (listing_id, price)
        values (existing.id, new_price);
      end if;
    end if;
  end loop;

  return inserted_count;
end;
$$;

-- ---------- SECURITY NOTE (v1 tradeoff, deliberate) ----------
-- RLS is intentionally NOT enabled: this is a single-user personal tool
-- and the extension/dashboard use the anon key directly. Supabase will
-- show an "RLS disabled" warning on these tables — that's expected for v1.
-- When/if you add more users: enable RLS, add a user_id column, and
-- write per-user policies. The schema above won't need to change shape.