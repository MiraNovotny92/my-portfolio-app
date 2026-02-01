export default async function handler(req, res) {
  // PASTE YOUR NEW KEY HERE (Keep the quotes!)
  const apiKey = "23713874ZXmqDynruBrDNmaKjIbrBgDHMeOtO"; 

  const fetchT212 = async (subdomain) => {
    try {
      const url = `https://${subdomain}.trading212.com/api/v0/equity/account/cash`;
      
      // CHAMELEON MODE: Look exactly like a Chrome Browser
      const headers = { 
        'Authorization': apiKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      };

      // We use the 'live' URL directly first
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        // Return the RAW text from T212 to see why they blocked us
        const errText = await response.text();
        console.log(`T212 Blocked Cash: ${response.status} - ${errText}`);
        return { success: false, status: response.status, error: errText };
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
    // 1. Try Live Server
    let result = await fetchT212('live');

    // 2. Try Demo if Live failed
    if (!result.success) {
      const demoResult = await fetchT212('demo');
      if (demoResult.success) result = demoResult;
    }

    // 3. IF FAILED
    if (!result.success) {
      return res.status(401).json({ 
        error: "Connection Failed", 
        debug_info: {
          reason: "T212 Firewall Blocked Vercel",
          status: result.status,
          details: result.error, // This will tell us if it's a Cloudflare block
          region: process.env.VERCEL_REGION || "Unknown (Likely US)"
        }
      });
    }

    // --- SUCCESS: TRANSLATE DATA ---
    const { cash, portfolio } = result;
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