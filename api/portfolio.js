export default async function handler(req, res) {
  // 1. CLEAN THE KEY (Remove accidental spaces)
  const rawKey = req.query.apiKey || "";
  const apiKey = rawKey.trim();

  if (!apiKey) return res.status(400).json({ error: "API Key is missing" });

  // Helper to fetch from T212 with detailed error tracking
  const fetchT212 = async (subdomain) => {
    try {
      const url = `https://${subdomain}.trading212.com/api/v0/equity/account/cash`;
      const res = await fetch(url, {
        headers: { 'Authorization': apiKey }
      });

      if (!res.ok) {
        // If it fails, return the SPECIFIC error from T212
        const text = await res.text();
        return { success: false, status: res.status, error: text };
      }

      const cash = await res.json();
      
      // If cash worked, get portfolio
      const portRes = await fetch(`https://${subdomain}.trading212.com/api/v0/equity/portfolio`, {
        headers: { 'Authorization': apiKey }
      });
      
      if (!portRes.ok) return { success: false, status: portRes.status, error: "Portfolio fetch failed" };
      
      const portfolio = await portRes.json();
      return { success: true, cash, portfolio };

    } catch (e) {
      return { success: false, status: 500, error: e.message };
    }
  };

  try {
    // 1. Try LIVE server
    let result = await fetchT212('live');

    // 2. If LIVE failed with 401 (Unauthorized), try DEMO
    if (!result.success) {
      console.log(`Live failed (${result.status}), trying Demo...`);
      const demoResult = await fetchT212('demo');
      
      // If Demo works, use it. If not, stick with the Live error to show the user.
      if (demoResult.success) {
        result = demoResult;
      }
    }

    // 3. IF STILL FAILING -> RETURN THE EXACT ERROR DETAILS
    if (!result.success) {
      return res.status(result.status || 500).json({ 
        error: "Connection Failed", 
        details: result.error, // <--- THIS IS WHAT WE NEED TO SEE
        server_status: result.status 
      });
    }

    const { cash, portfolio } = result;

    // --- TRANSLATION LAYER (Standard logic) ---
    const positions = Array.isArray(portfolio) ? portfolio.map(pos => ({
      name: pos.ticker,
      quantity: pos.quantity,
      avgPrice: pos.averagePrice,
      currPrice: pos.currentPrice,
      invested: pos.averagePrice * pos.quantity,
      value: pos.currentPrice * pos.quantity,
      profit: pos.ppl,
      percent: (pos.ppl / (pos.averagePrice * pos.quantity)),
      dividendPaid: 0
    })) : [];

    const marketAlloc = positions.map(p => ({ name: p.name, value: p.value })).sort((a, b) => b.value - a.value);

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
      allocations: { market: marketAlloc, sector: [], currency: [] },
      charts: { invested: [], dividends: [], history: [] }
    };

    return res.status(200).json(dashboardData);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}