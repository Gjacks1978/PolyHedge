// api/polymarket.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Known slugs for ETH price markets (weekly refreshes each week)
    // We fetch by tag and filter — this way it auto-updates each week
    const r = await fetch(
      "https://gamma-api.polymarket.com/events?active=true&closed=false&limit=100&order=volume&ascending=false&tag_slug=crypto",
      { headers: { "Accept": "application/json" } }
    );
    const eventArr = r.ok ? await r.json() : [];

    const ETH_KEYWORDS = ["what price will ethereum", "what price will eth"];

    const ethEvents = (Array.isArray(eventArr) ? eventArr : []).filter(e => {
      const t = (e.title || "").toLowerCase();
      return ETH_KEYWORDS.some(k => t.includes(k));
    });

    const result = [];

    for (const event of ethEvents) {
      const markets = event.markets || [];
      const outcomes = [];

      for (const m of markets) {
        // groupItemTitle has the strike like "↑ 2,200" or "2200"
        const q = m.groupItemTitle || m.question || "";
        
        // outcomePrices is JSON string e.g. '["0.19", "0.81"]'
        let prices = [];
        try { prices = JSON.parse(m.outcomePrices || "[]"); } catch {}
        
        // First price is "Yes" probability
        const odd = parseFloat(prices[0] || 0);
        if (odd <= 0.0005 || odd >= 0.9995) continue; // include <1% strikes

        // Extract strike number
        const priceMatch = q.replace(/,/g, "").match(/[\d]+/);
        if (!priceMatch) continue;
        const strike = parseFloat(priceMatch[0]);
        if (isNaN(strike) || strike < 500 || strike > 20000) continue;

        const isUp = q.includes("↑") || (!q.includes("↓") && !q.toLowerCase().includes("below") && !q.toLowerCase().includes("dip") && !q.toLowerCase().includes("under"));

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

      const allOutcomes = outcomes
        .sort((a, b) => b.strike - a.strike); // highest strike first

      if (allOutcomes.length > 0) {
        result.push({
          id: event.id,
          question: event.title,
          endDate: event.endDate,
          volume: event.volume,
          outcomes: allOutcomes,
        });
      }
    }

    // Sort: weekly first, then monthly, then yearly
    result.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

    res.status(200).json({
      success: result.length > 0,
      markets: result.slice(0, 3),
      fetchedAt: new Date().toISOString(),
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message, markets: [] });
  }
}
