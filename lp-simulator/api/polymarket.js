// api/polymarket.js
// Vercel Serverless Function — proxy para Polymarket Gamma API
// Resolve o problema de CORS do browser

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Busca mercados ETH semanais no Polymarket
    const response = await fetch(
      "https://gamma-api.polymarket.com/markets?" +
      new URLSearchParams({
        tag: "crypto",
        active: "true",
        closed: "false",
        limit: "50",
      }),
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "lp-simulator/1.0",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status}`);
    }

    const data = await response.json();

    // Filtra apenas mercados ETH de preço (weekly/monthly)
    const ethMarkets = data
      .filter(m => {
        const q = (m.question || "").toLowerCase();
        return (
          q.includes("ethereum") &&
          (q.includes("hit") || q.includes("reach") || q.includes("price") || q.includes("what price")) &&
          m.active
        );
      })
      .map(m => {
        // Extrai strikes e odds dos outcomes
        const outcomes = parseOutcomes(m);
        return {
          id: m.id,
          question: m.question,
          endDate: m.endDate,
          volume: m.volume,
          outcomes,
        };
      })
      .filter(m => m.outcomes.length > 0)
      .slice(0, 5); // top 5 mercados mais relevantes

    res.status(200).json({
      success: true,
      markets: ethMarkets,
      fetchedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Polymarket proxy error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      markets: [],
    });
  }
}

function parseOutcomes(market) {
  try {
    const tokens = market.tokens || [];
    const outcomes = [];

    for (const token of tokens) {
      // Extrai strike do outcome (ex: "↑ 2200", "$2,200", "2200")
      const outcome = token.outcome || "";
      const priceMatch = outcome.match(/[\d,]+/);
      if (!priceMatch) continue;

      const strike = parseFloat(priceMatch[0].replace(",", ""));
      if (isNaN(strike) || strike < 500 || strike > 20000) continue;

      const odd = parseFloat(token.price || 0);
      const isUp = outcome.includes("↑") || outcome.includes("above") || outcome.includes("hit");

      outcomes.push({
        outcome: token.outcome,
        strike,
        odd: odd,
        oddPct: (odd * 100).toFixed(1),
        payoffPer100: odd > 0 ? (100 / odd).toFixed(0) : "—",
        isUp,
        volume: token.volume || 0,
      });
    }

    return outcomes
      .filter(o => o.isUp)
      .sort((a, b) => a.strike - b.strike);
  } catch {
    return [];
  }
}
