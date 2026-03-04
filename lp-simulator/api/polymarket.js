// api/polymarket.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let ethMarkets = [];

    // Try 1: Events endpoint with crypto tag
    const eventsRes = await fetch(
      "https://gamma-api.polymarket.com/events?active=true&closed=false&limit=50&tag_slug=crypto",
      { headers: { "Accept": "application/json", "User-Agent": "lp-simulator/1.0" } }
    );

    if (eventsRes.ok) {
      const data = await eventsRes.json();
      const events = Array.isArray(data) ? data : (data.events || data.data || []);

      for (const event of events) {
        const q = (event.title || event.question || "").toLowerCase();
        if ((!q.includes("ethereum") && !q.includes("eth")) ||
            (!q.includes("price") && !q.includes("hit") && !q.includes("reach") && !q.includes("what"))) continue;

        const markets = event.markets || [];
        const outcomes = [];

        for (const m of markets) {
          const mq = m.question || m.groupItemTitle || m.title || "";
          const priceMatch = mq.match(/\$?([\d,]+)/);
          if (!priceMatch) continue;
          const strike = parseFloat(priceMatch[1].replace(",", ""));
          if (isNaN(strike) || strike < 500 || strike > 20000) continue;

          const tokens = m.tokens || [];
          const yesToken = tokens.find(t => (t.outcome||"").toLowerCase() === "yes") || tokens[0];
          const odd = yesToken ? parseFloat(yesToken.price || 0) : parseFloat(m.lastTradePrice || 0);
          if (odd <= 0) continue;

          outcomes.push({
            outcome: mq,
            strike,
            odd,
            oddPct: (odd * 100).toFixed(1),
            payoffPer100: (100 / odd).toFixed(0),
            isUp: true,
            volume: m.volume || 0,
          });
        }

        if (outcomes.length > 0) {
          outcomes.sort((a, b) => a.strike - b.strike);
          ethMarkets.push({ id: event.id, question: event.title || "ETH Price", endDate: event.endDate, volume: event.volume, outcomes });
        }
      }
    }

    // Try 2: Direct slug search for weekly ETH markets
    if (ethMarkets.length === 0) {
      const slugRes = await fetch(
        "https://gamma-api.polymarket.com/events?active=true&closed=false&limit=10&keyword=ethereum+price",
        { headers: { "Accept": "application/json" } }
      );
      if (slugRes.ok) {
        const data = await slugRes.json();
        const events = Array.isArray(data) ? data : (data.events || data.data || []);
        for (const event of events) {
          const markets = event.markets || [];
          const outcomes = [];
          for (const m of markets) {
            const mq = m.question || m.groupItemTitle || "";
            const priceMatch = mq.match(/\$?([\d,]+)/);
            if (!priceMatch) continue;
            const strike = parseFloat(priceMatch[1].replace(",", ""));
            if (isNaN(strike) || strike < 500 || strike > 20000) continue;
            const tokens = m.tokens || [];
            const yesToken = tokens.find(t => (t.outcome||"").toLowerCase() === "yes") || tokens[0];
            const odd = yesToken ? parseFloat(yesToken.price || 0) : 0;
            if (odd <= 0) continue;
            outcomes.push({ outcome: mq, strike, odd, oddPct: (odd*100).toFixed(1), payoffPer100: (100/odd).toFixed(0), isUp: true, volume: m.volume || 0 });
          }
          if (outcomes.length > 0) {
            outcomes.sort((a, b) => a.strike - b.strike);
            ethMarkets.push({ id: event.id, question: event.title || "ETH Price", endDate: event.endDate, volume: event.volume, outcomes });
          }
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
