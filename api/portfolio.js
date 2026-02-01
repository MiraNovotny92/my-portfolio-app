// api/portfolio.js
export default async function handler(req, res) {
  const { apiKey } = req.query;

  if (!apiKey) return res.status(400).json({ error: "API Key is required" });

  // Helper function to try fetching from a specific T212 server
  const fetchT212 = async (subdomain) => {
    const cashRes = await fetch(`https://${subdomain}.trading212.com/api/v0/equity/account/cash`, {
      headers: { 'Authorization': apiKey }
    });
    const portRes = await fetch(`https://${subdomain}.trading212.com/api/v0/equity/portfolio`, {
      headers: { 'Authorization': apiKey }
    });
    
    if (cashRes.ok && portRes.ok) {
      return { 
        cash: await cashRes.json(), 
        portfolio: await portRes.json() 
      };
    }
    return null;
  };

  try {
    // 1. Try LIVE server first
    let data = await fetchT212('live');

    // 2. If LIVE failed, try DEMO server
    if (!data) {
      console.log("Live server failed, trying Demo...");
      data = await fetchT212('demo');
    }

    if (!data) {
      return res.status(401).json({ error: "Invalid API Key or Wrong Server" });
    }

    const { cash, portfolio } = data;

    // 3. THE TRANSLATION LAYER (Converting T212 Data -> Jamiez App Data)
    
    // Map the positions
    const positions = portfolio.map(pos => ({
      name: pos.ticker,
      quantity: pos.quantity,
      avgPrice: pos.averagePrice,
      currPrice: pos.currentPrice,
      invested: pos.averagePrice * pos.quantity,
      value: pos.currentPrice * pos.quantity,
      profit: pos.ppl, // Profit/Loss
      percent: (pos.ppl / (pos.averagePrice * pos.quantity)),
      dividendPaid: 0 // API doesn't provide this yet
    }));

    // Calculate Sector Allocations (Simple grouping by Ticker for now)
    const marketAlloc = positions.map(p => ({ 
      name: p.name, 
      value: p.value 
    })).sort((a, b) => b.value - a.value);

    // Construct the final JSON
    const dashboardData = {
      accountSummary: {
        totalValue: cash.total,
        portfolioValue: cash.invested + cash.ppl,
        freeCash: cash.free,
        totalPL: cash.ppl,
        totalDividends: 0, 
        divsMonthly2025: 0,
        divsMonthly2026: 0
      },
      allPositions: positions,
      pies: [], 
      allocations: {
        market: marketAlloc,
        sector: [], // Can be enhanced later
        currency: []
      },
      // Empty charts for now (API only gives current Snapshot, not history)
      charts: { 
        invested: [], 
        dividends: [], 
        history: [] 
      } 
    };

    return res.status(200).json(dashboardData);

  } catch (error) {
    console.error("Translation Error:", error);
    return res.status(500).json({ error: error.message });
  }
}