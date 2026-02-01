// api/portfolio.js
export default async function handler(req, res) {
  // 1. Get the User's API Key from the request
  const { apiKey } = req.query;

  if (!apiKey) {
    return res.status(400).json({ error: "API Key is required" });
  }

  try {
    // 2. Fetch Account Cash Data (Free funds, Total Value)
    const cashRes = await fetch('https://live.trading212.com/api/v0/equity/account/cash', {
      headers: { 'Authorization': apiKey }
    });
    
    // 3. Fetch Portfolio Positions (Stocks)
    const portRes = await fetch('https://live.trading212.com/api/v0/equity/portfolio', {
      headers: { 'Authorization': apiKey }
    });

    if (!cashRes.ok || !portRes.ok) {
      throw new Error("Invalid API Key or T212 Error");
    }

    const cashData = await cashRes.json();
    const portData = await portRes.json();

    // 4. TRANSLATE T212 Data -> Jamiez Dashboard Format
    
    // Calculate totals
    const totalValue = cashData.total;
    const freeCash = cashData.free;
    const invested = cashData.invested;
    const totalPL = cashData.ppl; // Profit/Loss

    // Map Positions
    const positions = portData.map(pos => ({
      name: pos.ticker,
      quantity: pos.quantity,
      avgPrice: pos.averagePrice,
      currPrice: pos.currentPrice,
      invested: pos.averagePrice * pos.quantity,
      value: pos.currentPrice * pos.quantity,
      profit: pos.ppl,
      percent: (pos.ppl / (pos.averagePrice * pos.quantity)),
      dividendPaid: 0 // T212 API doesn't give historical dividends easily yet
    }));

    // Group Allocations (Simple fake grouping for now, can be improved)
    const allocations = {
      market: positions.map(p => ({ name: p.name, value: p.value })),
      sector: [], 
      currency: [] 
    };

    // 5. Return the "Clean" JSON that App.jsx expects
    const dashboardData = {
      accountSummary: {
        totalValue: totalValue,
        portfolioValue: invested + totalPL,
        freeCash: freeCash,
        totalPL: totalPL,
        totalDividends: 0, // Not available in simple API endpoint
        divsMonthly2025: 0,
        divsMonthly2026: 0
      },
      allPositions: positions,
      pies: [], // T212 API V0 doesn't support Pies endpoint yet
      allocations: allocations,
      charts: { invested: [], dividends: [], history: [] } // History requires database tracking over time
    };

    return res.status(200).json(dashboardData);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}