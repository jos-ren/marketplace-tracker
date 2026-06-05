// content.js — entry point. Detects the site, selects the matching parser,
// scans the cards already on the page, and watches for more via a debounced
// MutationObserver (for lazy-load / infinite scroll). Each card is parsed and
// handed to the queue, which dedupes within the session and batches sends.

function vtDetectSite(hostname) {
  if (hostname.includes("facebook")) return "facebook";
  if (hostname.includes("autotrader")) return "autotrader";
  if (hostname.includes("cargurus")) return "cargurus";
  if (hostname.includes("craigslist")) return "craigslist";
  if (hostname.includes("kijiji")) return "kijiji";
  return null;
}

function vtScan(parser) {
  let cards;
  try {
    cards = parser.findCards(document);
  } catch (err) {
    console.error("[vt] findCards failed:", err);
    return;
  }
  for (const card of cards) {
    let listing = null;
    try {
      listing = parser.parseCard(card);
    } catch (err) {
      // one bad card must never kill the loop
      continue;
    }
    if (listing && listing.external_id) enqueue(listing);
  }
}

(function vtMain() {
  const site = vtDetectSite(location.hostname);
  if (!site) {
    console.log("[vt] no parser for host:", location.hostname);
    return;
  }

  const parser = (window.vtParsers || {})[site];
  if (!parser) {
    console.log(`[vt] active on ${site}, but no parser implemented yet`);
    return;
  }

  console.log(`[vt] active on ${site}`);

  let scanTimer = null;
  function scheduleScan() {
    if (scanTimer !== null) clearTimeout(scanTimer);
    scanTimer = setTimeout(() => vtScan(parser), 600);
  }

  vtScan(parser); // initial pass over what's already rendered

  // re-scan as cards stream in (lazy images, infinite scroll, filter changes)
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
})();
