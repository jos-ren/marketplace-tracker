-- ============================================================
-- Migration: split "saved" out of status; add the "updated" status.
-- Run this ONCE in the Supabase SQL Editor on an existing project.
-- (Fresh installs get this from schema.sql and don't need it.)
--
-- Old status set: 'new' | 'viewed' | 'shortlisted' | 'hidden'
-- New status set: 'new' | 'updated' | 'seen'   (+ a separate `saved` boolean)
-- ============================================================

-- 1. New column: user-starred, independent of status.
alter table listings add column if not exists saved boolean not null default false;

-- 2. Carry the old "shortlisted" state over to the new saved flag.
update listings set saved = true where status = 'shortlisted';

-- 3. Collapse the old triaged statuses onto 'seen'; 'new' stays 'new'.
update listings set status = 'seen'
 where status in ('viewed', 'shortlisted', 'hidden');

-- 4. Replace the RPC so a re-scraped price change resurfaces a 'seen' listing
--    as 'updated'. (Identical to schema.sql — safe to run on a live DB.)
create or replace function upsert_listings(items jsonb)
returns integer
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
         mileage, location, photo_url, posted_date)
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
         item->>'photo_url',
         nullif(item->>'posted_date', '')::date)
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
        price      = coalesce(new_price, price),
        posted_date = coalesce(nullif(item->>'posted_date', '')::date, posted_date)
      where id = existing.id;

      if new_price is not null
         and existing.price is distinct from new_price then
        insert into price_history (listing_id, price)
        values (existing.id, new_price);

        if existing.status = 'seen' then
          update listings set status = 'updated' where id = existing.id;
        end if;
      end if;
    end if;
  end loop;

  return inserted_count;
end;
$$;
