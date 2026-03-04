// api/polymarket.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let ethMarkets = [];

    // Correct endpoint: search events with keyword, using proper field names
    const urls = [
      "https://gamma-api.polymarket.com/events?active=true&closed=false&limit=50&order=volume&ascending=false",
      "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume&ascending=false",
    ];

    // Try events endpoint first
    const eventsRes = await fetch(urls[0], {
      headers: { "Accept": "application/json", "User-Agent": "lp-simulator/1.0" },
    });

    if (eventsRes.ok) {
      const events = await eventsRes.json();
      const eventsArr = Array.isArray(events) ? events : [];

      for (const event of eventsArr) {
        const title = (event.title || "").toLowerCase();
        if (!title.includes("ethereum") && !title.includes("eth")) continue;
        if (!title.includes("price") && !title.includes("hit") && !title.includes("reach") && !title.includes("what")) continue;

        const markets = event.markets || [];
        const outcomes = [];

        for (const m of markets) {
          // Correct field: m.question for the outcome description
          const q = m.question || m.groupItemTitle || "";
          const priceMatch = q.match(/\$?([\d,]+)/);
          if (!priceMatch) continue;
          const strike = parseFloat(priceMatch[1].replace(",", ""));
          if (isNaN(strike) || strike < 500 || strike > 20000) continue;

          // Correct field: m.lastTradePrice is the current probability (0-1)
          const odd = parseFloat(m.lastTradePrice || m.bestAsk || m.outcomePrices?.[0] || 0);
          if (odd <= 0.005) continue;

          outcomes.push({
            outcome: q,
            strike,
            odd,
            oddPct: (odd * 100).toFixed(1),
            payoffPer100: (100 / odd).toFixed(0),
            isUp: !q.toLowerCase().includes("below") && !q.includes("↓"),
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

    // Fallback: try markets endpoint directly
    if (ethMarkets.length === 0) {
      const marketsRes = await fetch(urls[1], {
        headers: { "Accept": "application/json", "User-Agent": "lp-simulator/1.0" },
      });

      if (marketsRes.ok) {
        const allMarkets = await marketsRes.json();
        const arr = Array.isArray(allMarkets) ? allMarkets : [];

        for (const m of arr) {
          const q = (m.question || "").toLowerCase();
          if (!q.includes("ethereum") && !q.includes("eth")) continue;
          if (!q.includes("price") && !q.includes("hit") && !q.includes("reach")) continue;

          const priceMatch = (m.question || "").match(/\$?([\d,]+)/);
          if (!priceMatch) continue;
          const strike = parseFloat(priceMatch[1].replace(",", ""));
          if (isNaN(strike) || strike < 500 || strike > 20000) continue;

          const odd = parseFloat(m.lastTradePrice || m.bestAsk || 0);
          if (odd <= 0.005) continue;

          // Group individual markets into a single "event"
          let group = ethMarkets.find(g => g.id === (m.eventId || "direct"));
          if (!group) {
            group = { id: m.eventId || "direct", question: "ETH Weekly Price", endDate: m.endDate, volume: 0, outcomes: [] };
            ethMarkets.push(group);
          }
          group.outcomes.push({
            outcome: m.question,
            strike,
            odd,
            oddPct: (odd * 100).toFixed(1),
            payoffPer100: (100 / odd).toFixed(0),
            isUp: true,
            volume: parseFloat(m.volume || 0),
          });
        }

        // Sort outcomes within each group
        for (const g of ethMarkets) {
          g.outcomes.sort((a, b) => a.strike - b.strike);
        }
      }
    }

    res.status(200).json({
      success: ethMarkets.length > 0,
      markets: ethMarkets.slice(0, 3),
      fetchedAt: new Date().toISOString(),
      debug: { found: ethMarkets.length },
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message, markets: [] });
  }
}
