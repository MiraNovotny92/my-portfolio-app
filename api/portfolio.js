export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const apiKey = searchParams.get('apiKey') || "";
  const apiSecret = searchParams.get('apiSecret') || "";

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API Key is required" }), { status: 400 });
  }

  const credentials = btoa(`${apiKey.trim()}:${apiSecret.trim()}`);
  const authHeader = `Basic ${credentials}`;

  const fetchT212 = async (subdomain, endpoint) => {
    const targetUrl = `https://${subdomain}.trading212.com/api/v0/equity/${endpoint}`;
    
    // We use a public proxy to bypass Cloudflare's Vercel-specific block
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

    try {
      const response = await fetch(proxyUrl, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`Proxy Error: ${response.status}`);
      
      const wrapper = await response.json();
      // allorigins returns the actual API response inside a "contents" string
      return JSON.parse(wrapper.contents);
    } catch (e) {
      console.error(`Error fetching ${endpoint}:`, e);
      throw e;
    }
  };

  try {
    // Attempt to fetch via proxy
    const summary = await fetchT212('live', 'account/summary');
    const portfolio = await fetchT212('live', 'positions');

    // MAPPING DATA TO DASHBOARD
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

    return new Response(JSON.stringify(dashboardData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: "Cloudflare/Proxy Blocked", 
      debug_info: { details: error.message } 
    }), { status: 500 });
  }
}