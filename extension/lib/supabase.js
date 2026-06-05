// lib/supabase.js — thin fetch wrapper around the upsert_listings RPC.
//
// Relies on SUPABASE_URL and SUPABASE_ANON_KEY from config.js, which is
// injected before this file (see manifest.json). All content scripts in this
// extension share one isolated-world scope per page, so those consts are visible
// here.

// Send a batch of listings to Supabase. Returns the number of NEW rows inserted
// (the RPC returns an integer), or 0 on any failure. Never throws.
async function sendListings(items) {
  if (!items || items.length === 0) return 0;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[vt] upsert_listings failed: ${res.status} ${res.statusText}`, detail);
      return 0;
    }

    const inserted = await res.json(); // RPC returns a bare integer
    return typeof inserted === "number" ? inserted : 0;
  } catch (err) {
    console.error("[vt] upsert_listings error:", err);
    return 0;
  }
}
