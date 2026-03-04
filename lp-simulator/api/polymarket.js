// api/polymarket.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const debug = {};

    // Try exact slug pattern from screenshot
    const now = new Date();
    const month = now.toLocaleString("en-US", { month: "long" }).toLowerCase();
    const slugGuesses = [
      `what-price-will-ethereum-hit-${month}`,
      `what-price-will-ethereum-hit`,
      `ethereum-price-${month}`,
      `ethereum-weekly`,
    ];

    let ethMarkets = [];

    // Try each slug guess
    for (const slug of slugGuesses) {
      const url = `https://gamma-api.polymarket.com/events?slug=${slug}&active=true&closed=false`;
      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      const data = r.ok ? await r.json() : [];
      const arr = Array.isArray(data) ? data : [];
      debug[slug] = arr.length;
      if (arr.length > 0 && ethMarkets.length === 0) {
        ethMarkets = arr;
      }
    }

    // Fallback: get recent events ordered by newest and look for ETH
    if (ethMarkets.length === 0) {
      const r = await fetch(
        "https://gamma-api.polymarket.com/events?active=true&closed=false&limit=100&order=createdAt&ascending=false",
        { headers: { "Accept": "application/json" } }
      );
      const data = r.ok ? await r.json() : [];
      const arr = Array.isArray(data) ? data : [];
      debug.recent_total = arr.length;
      debug.recent_titles = arr.slice(0, 10).map(e => e.title);

      const eth = arr.filter(e => {
        const t = (e.title || e.slug || "").toLowerCase();
        return (t.includes("eth") || t.includes("ether")) &&
               (t.includes("price") || t.includes("hit") || t.includes("reach") || t.includes("march") || t.includes("april"));
      });
      debug.eth_found = eth.map(e => ({ title: e.title, slug: e.slug, markets: (e.markets||[]).length }));
      ethMarkets = eth;
    }

    if (ethMarkets.length === 0) {
      return res.status(200).json({ success: false, markets: [], debug, fetchedAt: new Date().toISOString() });
    }

    // Parse markets from found events
    const result = [];
    for (const event of ethMarkets.slice(0, 3)) {
      const markets = event.markets || [];
      const outcomes = [];
      for (const m of markets) {
        const q = m.groupItemTitle || m.question || "";
        let prices = [];
        try { prices = JSON.parse(m.outcomePrices || "[]"); } catch {}
        const odd = parseFloat(prices[0] || 0);
        if (odd <= 0.005 || odd >= 0.995) continue;
        const priceMatch = q.match(/\$?([\d,]+)/);
        if (!priceMatch) continue;
        const strike = parseFloat(priceMatch[1].replace(",", ""));
        if (isNaN(strike) || strike < 500 || strike > 20000) continue;
        const isUp = !q.toLowerCase().includes("below") && !q.includes("↓");
        outcomes.push({ outcome: q, strike, odd, oddPct: (odd*100).toFixed(1), payoffPer100: (100/odd).toFixed(0), isUp, volume: parseFloat(m.volume||0) });
      }
      const upOutcomes = outcomes.filter(o => o.isUp).sort((a,b) => a.strike - b.strike);
      if (upOutcomes.length > 0) result.push({ id: event.id, question: event.title, endDate: event.endDate, volume: event.volume, outcomes: upOutcomes });
    }

    res.status(200).json({ success: result.length > 0, markets: result, debug, fetchedAt: new Date().toISOString() });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message, markets: [] });
  }
}
