// api/portfolio.js
export default async function handler(req, res) {
  const rawKey = req.query.apiKey || "";
  const apiKey = rawKey.trim();

  // --- INSPECTOR: Return info about the key (Safely) ---
  if (!apiKey) return res.status(400).json({ error: "No API Key received" });

  const fetchT212 = async (subdomain) => {
    try {
      const url = `https://${subdomain}.trading212.com/api/v0/equity/account/cash`;
      const response = await fetch(url, {
        headers: { 'Authorization': apiKey }
      });
      
      if (!response.ok) {
        // Return failure info
        return { success: false, status: response.status };
      }

      const cash = await response.json();
      
      // If cash worked, fetch portfolio
      const portRes = await fetch(`https://${subdomain}.trading212.com/api/v0/equity/portfolio`, {
        headers: { 'Authorization': apiKey }
      });

      if (!portRes.ok) return { success: false, status: portRes.status };

      const portfolio = await portRes.json();
      return { success: true, cash, portfolio };

    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  try {
    // 1. Try Live
    let result = await fetchT212('live');

    // 2. Try Demo
    if (!result.success) {
      const demoResult = await fetchT212('demo');
      if (demoResult.success) result = demoResult;
    }

    // 3. IF FAILED: Return Debug Info
    if (!result.success) {
      return res.status(401).json({ 
        error: "Connection Failed", 
        debug_info: {
          key_length: apiKey.length, // How many characters?
          key_start: apiKey.substring(0, 4) + "...", // Does it start with 2000?
          last_status: result.status || "Unknown"
        }
      });
    }

    // --- SUCCESS: TRANSLATE DATA ---
    const { cash, portfolio } = result;
    
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