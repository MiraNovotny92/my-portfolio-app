export const config = { runtime: 'edge' };

export default async function handler(req) {
  // 1. GET URL PARAMETERS (Different in Edge Mode)
  const { searchParams } = new URL(req.url);
  const rawKey = searchParams.get('apiKey') || "";
  
  // OR USE HARDCODED KEY IF YOU PREFER TESTING:
  const apiKey = rawKey.trim() || "23713874ZwrYRjcQxJPqCXfjRXLHXtWLfkmIU"; 

  if (!apiKey || apiKey.length < 10) {
    return new Response(JSON.stringify({ error: "API Key is missing or invalid" }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Helper to fetch from T212
  const fetchT212 = async (subdomain) => {
    try {
      const url = `https://${subdomain}.trading212.com/api/v0/equity/account/cash`;
      
      const headers = { 
        'Authorization': apiKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };

      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        return { success: false, status: response.status, error: await response.text() };
      }

      const cash = await response.json();
      
      const portRes = await fetch(`https://${subdomain}.trading212.com/api/v0/equity/portfolio`, { headers });
      
      if (!portRes.ok) return { success: false, status: portRes.status };

      return { success: true, cash, portfolio: await portRes.json() };

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
      return new Response(JSON.stringify({ 
        error: "Connection Failed", 
        debug_info: {
          reason: "T212 Rejected Connection",
          status: result.status,
          region: "Edge Network (Should be EU)", // We changed this!
          details: result.error
        }
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
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