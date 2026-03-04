// api/polymarket.js — Debug version
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Fetch raw and return first 2 events so we can see the structure
    const r = await fetch(
      "https://gamma-api.polymarket.com/events?active=true&closed=false&limit=5&order=volume&ascending=false",
      { headers: { "Accept": "application/json", "User-Agent": "lp-simulator/1.0" } }
    );
    const raw = await r.json();
    const arr = Array.isArray(raw) ? raw : [];

    res.status(200).json({
      total: arr.length,
      // Return first 2 events with their keys so we can see the structure
      sample: arr.slice(0, 2).map(e => ({
        keys: Object.keys(e),
        title: e.title,
        slug: e.slug,
        markets_count: (e.markets || []).length,
        first_market_keys: e.markets?.[0] ? Object.keys(e.markets[0]) : [],
        first_market_sample: e.markets?.[0],
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
