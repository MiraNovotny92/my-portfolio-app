// api/portfolio.js
export default async function handler(req, res) {
  const rawKey = req.query.apiKey || "";
  const apiKey = rawKey.trim();

  if (!apiKey) return res.status(400).json({ error: "No API Key received" });

  const fetchT212 = async (subdomain) => {
    try {
      const url = `https://${subdomain}.trading212.com/api/v0/equity/account/cash`;
      
      // NEW: We add 'User-Agent' so T212 doesn't block us as a bot
      const headers = { 
        'Authorization': apiKey,
        'User-Agent': 'Jamiez-Portfolio/1.0',
        'Content-Type': 'application/json'
      };

      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        return { success: false, status: response.status };
      }

      const cash = await response.json();
      
      const portRes = await fetch(`https://${subdomain}.trading212.com/api/v0/equity/portfolio`, { headers });

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

    // 2. Try Demo if live failed
    if (!result.success) {
      const demoResult = await fetchT212('demo');
      if (demoResult.success) result = demoResult;
    }

    // 3. IF STILL FAILING
    if (!result.success) {
      return res.status(401).json({ 
        error: "Connection Failed", 
        debug_info: {
          reason: "T212 Blocked Request",
          status: result.status,
          hint: "Try regenerating the key one last time."
        }
      });
    }

    // --- SUCCESS: TRANSLATE DATA ---
    const { cash, portfolio } = result;
    
    // Safety check: Ensure portfolio is an array
    const cleanPortfolio = Array.isArray(portfolio) ? portfolio : [];

    const positions = cleanPortfolio.map(pos => ({
      name: pos.ticker,
      quantity: pos.quantity,
      avgPrice: pos.averagePrice,
      currPrice: pos.currentPrice,
      invested: pos.averagePrice * pos.quantity,
      value: pos.currentPrice * pos.quantity,
      profit: pos.ppl,
      percent: (pos.averagePrice > 0 ? pos.ppl / (pos.averagePrice * pos.quantity) : 0),
      dividendPaid: 0
    }));

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