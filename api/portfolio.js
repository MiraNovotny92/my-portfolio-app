// Remove the 'edge' config - it's too easy for Cloudflare to detect
export default async function handler(req, res) {
  const { apiKey, apiSecret } = req.query;

  if (!apiKey) {
    return res.status(400).json({ error: "API Key is required" });
  }

  // Basic Auth encoding
  const authHeader = `Basic ${Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString('base64')}`;

  const fetchT212 = async (subdomain, endpoint) => {
    const url = `https://${subdomain}.trading212.com/api/v0/equity/${endpoint}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Connection': 'keep-alive',
        // This specific User-Agent is less likely to be blocked
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`T212 Error ${response.status}: ${text.substring(0, 100)}`);
    }
    return await response.json();
  };

  try {
    // 1. Fetch data directly
    const summary = await fetchT212('live', 'account/summary');
    const portfolio = await fetchT212('live', 'positions');

    // 2. Map positions
    const positions = portfolio.map(pos => ({
      name: pos.instrument.name || pos.instrument.ticker,
      ticker: pos.instrument.ticker,
      quantity: pos.quantity,
      avgPrice: pos.averagePricePaid,
      currPrice: pos.currentPrice,
      invested: pos.walletImpact.totalCost,
      value: pos.walletImpact.currentValue,
      profit: pos.walletImpact.unrealizedProfitLoss,
      percent: pos.walletImpact.totalCost > 0 ? (pos.walletImpact.unrealizedProfitLoss / pos.walletImpact.totalCost) : 0,
      dividendPaid: 0
    }));

    // 3. Build Dashboard JSON
    const dashboardData = {
      accountSummary: {
        totalValue: summary.cash.total,
        portfolioValue: summary.investments.currentValue,
        freeCash: summary.cash.availableToTrade,
        totalPL: summary.investments.unrealizedProfitLoss,
        totalDividends: 0,
        divsMonthly2025: 0,
        divsMonthly2026: 0
      },
      allPositions: positions,
      pies: [], 
      allocations: {
        market: positions.map(p => ({ name: p.name, value: p.value })).sort((a,b) => b.value - a.value),
        sector: [],
        currency: []
      },
      charts: { invested: [], dividends: [], history: [] }
    };

    return res.status(200).json(dashboardData);

  } catch (error) {
    console.error("Sync Error:", error.message);
    return res.status(500).json({ 
      error: "Sync Failed", 
      debug_info: { details: error.message } 
    });
  }
}