// lib/queue.js — in-session dedupe + debounced batch flushing.
//
// Goal: as the MutationObserver fires repeatedly while browsing/scrolling, we
// must NOT re-send listings we've already handled this page session, and we
// should batch sends rather than firing one request per card.

const VT_BATCH_SIZE = 10;       // flush as soon as this many are pending
const VT_FLUSH_DELAY_MS = 2000; // ...or this long after the last enqueue

const vtSentKeys = new Set(); // "source:external_id" already handled this session
let vtPending = [];           // listings waiting to be flushed
let vtFlushTimer = null;

function vtListingKey(listing) {
  return `${listing.source}:${listing.external_id}`;
}

// Add a listing to the outgoing batch. Skips anything we've already enqueued
// this session (so scrolling past the same card repeatedly is a no-op).
function enqueue(listing) {
  if (!listing || !listing.source || !listing.external_id) return;

  const key = vtListingKey(listing);
  if (vtSentKeys.has(key)) return;
  vtSentKeys.add(key); // claim it now so dupes within one batch are skipped too

  vtPending.push(listing);

  if (vtPending.length >= VT_BATCH_SIZE) {
    vtFlush();
  } else {
    vtScheduleFlush();
  }
}

function vtScheduleFlush() {
  if (vtFlushTimer !== null) clearTimeout(vtFlushTimer);
  vtFlushTimer = setTimeout(vtFlush, VT_FLUSH_DELAY_MS);
}

// Send whatever is pending right now. Safe to call directly or via the timer.
async function vtFlush() {
  if (vtFlushTimer !== null) {
    clearTimeout(vtFlushTimer);
    vtFlushTimer = null;
  }
  if (vtPending.length === 0) return;

  const batch = vtPending;
  vtPending = [];

  const inserted = await sendListings(batch);
  console.log(`[vt] flushed ${batch.length} listing(s) → ${inserted} new`);
}
