import admin from 'firebase-admin';

const cleanKey = (key) => {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n').replace(/"/g, '').trim();
};

if (!admin.apps.length) {
  try {
    const pKey = cleanKey(process.env.FIREBASE_PRIVATE_KEY);
    if (process.env.FIREBASE_PROJECT_ID && pKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: pKey,
        }),
      });
    }
  } catch (e) { console.error("Firebase Init Error:", e.message); }
}

const db = admin.firestore();

export default async function handler(req, res) {
  const { apiKey, apiSecret, userId } = req.query;
  if (!apiKey || !apiSecret || !userId) return res.status(400).json({ error: "Missing params" });

  const authHeader = `Basic ${Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString('base64')}`;
  const userRef = db.collection('users').doc(userId);

  try {
    // 1. FETCH BASE ACCOUNT DATA
    const [summaryRes, positionsRes] = await Promise.all([
      fetch(`https://live.trading212.com/api/v0/equity/account/summary`, { 
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' } 
      }),
      fetch(`https://live.trading212.com/api/v0/equity/positions`, { 
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' } 
      })
    ]);

    if (!summaryRes.ok || !positionsRes.ok) return res.status(401).json({ error: "T212 Connection Failed" });

    const summary = await summaryRes.json();
    const portfolio = await positionsRes.json();
    const totalValue = summary.totalValue;
    const totalInvested = summary.investments.totalCost;
    const today = new Date().toISOString().split('T')[0];

    // 2. THE DIVIDEND CRAWLER (Replaces Google Sheets Sync)
    // We crawl the history in 50-item chunks until we hit the end
    let nextPath = "/api/v0/equity/history/dividends?limit=50";
    let syncCount = 0;

    while (nextPath && syncCount < 10) { // Limit to 10 pages (500 entries) per refresh for safety
      const divRes = await fetch(`https://live.trading212.com${nextPath}`, { 
        headers: { 'Authorization': authHeader } 
      });
      if (!divRes.ok) break;
      
      const divData = await divRes.json();
      const batch = db.batch();
      
      divData.items.forEach(item => {
        const docRef = userRef.collection('dividends').doc(String(item.reference));
        batch.set(docRef, {
          ticker: item.ticker,
          amount: Number(item.amount),
          date: item.paidOn,
          type: item.type
        }, { merge: true });
      });
      
      await batch.commit();
      nextPath = divData.nextPagePath;
      syncCount++;
    }

    // 3. DATABASE RECOVERY & AGGREGATION
    await userRef.collection('history').doc(today).set({
      date: today,
      balance: totalValue,
      invested: totalInvested,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const [histSnap, divSnap] = await Promise.all([
      userRef.collection('history').orderBy('date', 'asc').get(),
      userRef.collection('dividends').orderBy('date', 'asc').get()
    ]);

    let totalDivsCalculated = 0;
    const divsForChart = divSnap.docs.map(doc => {
      const d = doc.data();
      totalDivsCalculated += d.amount;
      return { date: d.date, total: totalDivsCalculated };
    });

    const historyData = histSnap.docs.map(doc => ({
      date: doc.data().date,
      balance: doc.data().balance,
      invested: doc.data().invested
    }));

    // 4. DYNAMIC ALLOCATIONS
    const marketGroups = {}, sectorGroups = {}, currencyGroups = {};
    const positions = portfolio
      .filter(p => p.walletImpact.currentValue > 1) // Filter out leftovers worth < 1 CZK
      .map(p => {
        const val = p.walletImpact.currentValue;
        const ticker = p.instrument.ticker;
        const cur = p.instrument.currency === "GBX" ? "GBP" : (p.instrument.currency || "USD");

        // Grouping logic
        let mkt = (ticker.includes("_US_EQ") || cur === "USD") ? "US Market 🇺🇸" : 
                  (ticker.includes("_UK_EQ") || cur === "GBP") ? "London 🇬🇧" : "Europe 🇪🇺";
        marketGroups[mkt] = (marketGroups[mkt] || 0) + val;
        
        let sct = p.instrument.name.match(/MSCI|Vanguard|Acc|ETF/i) ? "Diversified (ETFs)" : "Individual Stocks";
        sectorGroups[sct] = (sectorGroups[sct] || 0) + val;
        currencyGroups[cur] = (currencyGroups[cur] || 0) + val;

        return {
          name: p.instrument.name,
          ticker: ticker,
          quantity: p.quantity,
          avgPrice: p.averagePricePaid,
          currPrice: p.currentPrice,
          invested: p.walletImpact.totalCost,
          value: val,
          profit: p.walletImpact.unrealizedProfitLoss,
          percent: p.walletImpact.totalCost > 0 ? (p.walletImpact.unrealizedProfitLoss / p.walletImpact.totalCost) : 0,
          dividendPaid: 0 // Frontend can sum this from history
        };
      });

    const formatAlloc = (group) => Object.keys(group).map(name => ({ name, value: group[name] })).sort((a,b) => b.value - a.value);

    // 5. FINAL RESPONSE
    res.status(200).json({
      accountSummary: {
        totalValue,
        totalInvested,
        freeCash: summary.cash.availableToTrade,
        totalPL: (summary.investments.unrealizedProfitLoss + summary.investments.realizedProfitLoss),
        totalDividends: totalDivsCalculated
      },
      allPositions: positions,
      pies: [], 
      allocations: {
        market: formatAlloc(marketGroups),
        sector: formatAlloc(sectorGroups),
        currency: formatAlloc(currencyGroups)
      },
      charts: { history: historyData, dividends: divsForChart, invested: [] }
    });
  } catch (error) { res.status(500).json({ error: "Server Error", details: error.message }); }
}