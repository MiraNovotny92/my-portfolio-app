export const config = { runtime: 'edge' };

export default async function handler(req) {
  // 1. GET PARAMETERS FROM URL
  const { searchParams } = new URL(req.url);
  const apiKey = searchParams.get('apiKey') || "";
  const apiSecret = searchParams.get('apiSecret') || "";

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API Key is required" }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 2. CREATE THE BASIC AUTH HEADER
  // T212 expects "ApiKey:ApiSecret" encoded in Base64
  const credentials = btoa(`${apiKey.trim()}:${apiSecret.trim()}`);
  const authHeader = `Basic ${credentials}`;

  const fetchT212 = async (subdomain) => {
    const headers = { 
      'Authorization': authHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    };

    try {
      // Fetch Account Summary
      const summaryRes = await fetch(`https://${subdomain}.trading212.com/api/v0/equity/account/summary`, { headers });
      if (!summaryRes.ok) return { success: false, status: summaryRes.status, error: await summaryRes.text() };
      const summary = await summaryRes.json();
      
      // Fetch Open Positions
      const portRes = await fetch(`https://${subdomain}.trading212.com/api/v0/equity/positions`, { headers });
      if (!portRes.ok) return { success: false, status: portRes.status };
      const portfolio = await portRes.json();

      return { success: true, summary, portfolio };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  try {
    // Try Live server first
    let result = await fetchT212('live');
    
    // If Live fails with Unauthorized, try Demo
    if (!result.success && result.status === 401) {
      result = await fetchT212('demo');
    }

    if (!result.success) {
      return new Response(JSON.stringify({ 
        error: "Connection Failed", 
        debug_info: {
          status: result.status,
          details: result.error,
          hint: "Ensure both API Key and Secret are entered correctly in the app setup."
        }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { summary, portfolio } = result;

    // 3. TRANSLATE DATA TO YOUR DASHBOARD FORMAT
    const positions = Array.isArray(portfolio) ? portfolio.map(pos => ({
      name: pos.instrument.name || pos.instrument.ticker,
      ticker: pos.instrument.ticker,
      quantity: pos.quantity,
      avgPrice: pos.averagePricePaid,
      currPrice: pos.currentPrice,
      invested: pos.walletImpact.totalCost,
      value: pos.walletImpact.currentValue,
      profit: pos.walletImpact.unrealizedProfitLoss,
      percent: pos.walletImpact.totalCost > 0 ? (pos.walletImpact.unrealizedProfitLoss / pos.walletImpact.totalCost) : 0,
      dividendPaid: 0 // API v0 doesn't provide per-stock dividend history easily
    })) : [];

    const marketAlloc = positions
      .map(p => ({ name: p.name, value: p.value }))
      .sort((a, b) => b.value - a.value);

    // This structure matches your 1000+ line App.jsx requirements
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
        market: marketAlloc, 
        sector: [], 
        currency: [] 
      },
      // Important: Empty arrays prevent ".map is not a function" errors in your charts
      charts: { 
        invested: [], 
        dividends: [], 
        history: [] 
      }
    };

    return new Response(JSON.stringify(dashboardData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}