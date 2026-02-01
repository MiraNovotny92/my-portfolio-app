export default async function handler(req, res) {
  // TRICK: .trim() removes accidental spaces from copy-pasting
  const apiKey = (req.query.apiKey || "").trim();

  if (!apiKey) return res.status(400).json({ error: "API Key is required" });

  const fetchT212 = async (subdomain) => {
    try {
      const cashRes = await fetch(`https://${subdomain}.trading212.com/api/v0/equity/account/cash`, {
        headers: { 'Authorization': apiKey }
      });
      // If the key is wrong, this will return 401 (Unauthorized)
      if (!cashRes.ok) return null;

      const portRes = await fetch(`https://${subdomain}.trading212.com/api/v0/equity/portfolio`, {
        headers: { 'Authorization': apiKey }
      });
      if (!portRes.ok) return null;
      
      return { 
        cash: await cashRes.json(), 
        portfolio: await portRes.json() 
      };
    } catch (e) {
      return null;
    }
  };

  try {
    // 1. Try LIVE server
    let data = await fetchT212('live');

    // 2. Try DEMO server
    if (!data) data = await fetchT212('demo');

    if (!data) {
      // If both fail, it's definitely the Key or Permissions
      return res.status(401).json({ error: "T212 rejected the key. Check permissions (Account & Portfolio)." });
    }

    const { cash, portfolio } = data;

    // --- TRANSLATION LAYER ---
    const positions = portfolio.map(pos => ({
      name: pos.ticker,
      quantity: pos.quantity,
      avgPrice: pos.averagePrice,
      currPrice: pos.currentPrice,
      invested: pos.averagePrice * pos.quantity,
      value: pos.currentPrice * pos.quantity,
      profit: pos.ppl,
      percent: (pos.ppl / (pos.averagePrice * pos.quantity)),
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