export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const apiKey = searchParams.get('apiKey') || "";
  const apiSecret = searchParams.get('apiSecret') || "";

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API Key is required" }), { status: 400 });
  }

  // Create the auth header
  const authHeader = `Basic ${btoa(`${apiKey.trim()}:${apiSecret.trim()}`)}`;

  const fetchT212 = async (subdomain, endpoint) => {
    const url = `https://${subdomain}.trading212.com/api/v0/equity/${endpoint}`;
    
    // We are going back to DIRECT fetch but with very specific 'browser-mimic' headers
    // Cloudflare is less likely to block 1MB+ data if the headers look like a standard Mac/Chrome user.
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Referer': 'https://www.trading212.com/',
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`T212 Error ${response.status}: ${text.substring(0, 100)}`);
    }
    return await response.json();
  };

  try {
    // 1. Fetch data directly (No Proxy = No 1MB Limit)
    // We fetch one by one to avoid triggering rate limits
    const summary = await fetchT212('live', 'account/summary');
    const portfolio = await fetchT212('live', 'positions');

    // 2. Map positions (This is where your 1000+ line App.jsx gets its fuel)
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

    // 3. Build the final response
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
    // If we get blocked again, we will see it here
    return new Response(JSON.stringify({ 
      error: "Sync Failed", 
      debug_info: { details: error.message } 
    }), { status: 500 });
  }
}