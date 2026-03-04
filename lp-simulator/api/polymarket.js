// api/polymarket.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let ethMarkets = [];

    // Search specifically for ETH price events by slug keyword
    const searches = [
      "https://gamma-api.polymarket.com/events?active=true&closed=false&limit=50&slug=what-price-will-ethereum",
      "https://gamma-api.polymarket.com/events?active=true&closed=false&limit=50&slug=ethereum-price",
      "https://gamma-api.polymarket.com/events?active=true&closed=false&limit=200&order=startDate&ascending=false",
    ];

    for (const url of searches) {
      if (ethMarkets.length > 0) break;

      const r = await fetch(url, {
        headers: { "Accept": "application/json", "User-Agent": "lp-simulator/1.0" },
      });
      if (!r.ok) continue;

      const data = await r.json();
      const events = Array.isArray(data) ? data : [];

      for (const event of events) {
        const title = (event.title || event.slug || "").toLowerCase();
        if (!title.includes("ethereum") && !title.includes("eth")) continue;
        if (!title.includes("price") && !title.includes("hit") && !title.includes("reach") && !title.includes("what")) continue;

        const markets = event.markets || [];
        const outcomes = [];

        for (const m of markets) {
          const q = m.groupItemTitle || m.question || "";
          // outcomePrices is a JSON string like '["0.19", "0.81"]'
          let prices = [];
          try {
            prices = JSON.parse(m.outcomePrices || "[]");
          } catch { prices = []; }

          const odd = parseFloat(prices[0] || m.lastTradePrice || 0);
          if (odd <= 0.005 || odd >= 0.99) continue;

          // Extract strike from groupItemTitle (e.g. "2,200" or "$2200")
          const priceMatch = q.match(/\$?([\d,]+)/);
          if (!priceMatch) continue;
          const strike = parseFloat(priceMatch[1].replace(",", ""));
          if (isNaN(strike) || strike < 500 || strike > 20000) continue;

          const isUp = !q.toLowerCase().includes("below") && !q.includes("↓") && !q.toLowerCase().includes("under");

          outcomes.push({
            outcome: q,
            strike,
            odd,
            oddPct: (odd * 100).toFixed(1),
            payoffPer100: (100 / odd).toFixed(0),
            isUp,
            volume: parseFloat(m.volume || 0),
          });
        }

        const upOutcomes = outcomes.filter(o => o.isUp).sort((a, b) => a.strike - b.strike);
        if (upOutcomes.length > 0) {
          ethMarkets.push({
            id: event.id,
            question: event.title,
            endDate: event.endDate,
            volume: event.volume,
            outcomes: upOutcomes,
          });
        }
      }
    }

    res.status(200).json({
      success: ethMarkets.length > 0,
      markets: ethMarkets.slice(0, 3),
      fetchedAt: new Date().toISOString(),
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message, markets: [] });
  }
}
