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
    
    // Switch to corsproxy.io - it often handles Cloudflare better than AllOrigins
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    try {
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
          // High-authority headers to look like a modern browser
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Status ${response.status}: ${errText.substring(0, 100)}`);
      }
      
      return await response.json();
    } catch (e) {
      console.error(`Fetch Error (${endpoint}):`, e.message);
      throw e;
    }
  };

  try {
    // Try live first
    const summary = await fetchT212('live', 'account/summary');
    const portfolio = await fetchT212('live', 'positions');

    // Reuse your mapping logic exactly as it was
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
      error: "Connection Refused by T212", 
      debug_info: { details: error.message, hint: "Check if the API Key has 'Unrestricted IP' selected in T212 settings." } 
    }), { status: 500 });
  }
}