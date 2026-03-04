// api/polymarket.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // The weekly ETH price markets use the /markets endpoint with specific search
    // From screenshot: "What price will Ethereum hit March 2-8?"
    // These are individual markets with strikes like "↑ 2,200"
    
    const r = await fetch(
      "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume&ascending=false&tag_slug=crypto",
      { headers: { "Accept": "application/json" } }
    );
    
    const data = r.ok ? await r.json() : [];
    const arr = Array.isArray(data) ? data : [];

    // Find ETH price markets — they have questions like "↑ 2,700" and share an eventId
    const ethPriceMarkets = arr.filter(m => {
      const q = (m.question || "").toLowerCase();
      const slug = (m.slug || "").toLowerCase();
      return (slug.includes("ethereum") || slug.includes("eth")) &&
             (slug.includes("price") || slug.includes("hit") || q.match(/↑|↓/) || q.match(/\$[\d,]+/));
    });

    // Also try searching by the event slug pattern from screenshot
    const eventSlugR = await fetch(
      "https://gamma-api.polymarket.com/events?active=true&closed=false&limit=100&order=volume&ascending=false&tag_slug=crypto",
      { headers: { "Accept": "application/json" } }
    );
    const eventData = eventSlugR.ok ? await eventSlugR.json() : [];
    const eventArr = Array.isArray(eventData) ? eventData : [];
    
    const ethEvents = eventArr.filter(e => {
      const t = (e.title || e.slug || "").toLowerCase();
      return (t.includes("eth") || t.includes("ether")) &&
             (t.includes("price") || t.includes("hit") || t.includes("what price"));
    });

    const debug = {
      markets_total: arr.length,
      eth_price_markets: ethPriceMarkets.map(m => ({ q: m.question, slug: m.slug, price: m.outcomePrices })),
      events_total: eventArr.length,
      eth_events: ethEvents.map(e => ({ title: e.title, slug: e.slug, markets: (e.markets||[]).length })),
    };

    res.status(200).json({ success: false, markets: [], debug, fetchedAt: new Date().toISOString() });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
