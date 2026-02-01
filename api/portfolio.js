import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (e) { console.error("Firebase Init Error:", e.message); }
}

const db = admin.firestore();

export default async function handler(req, res) {
  const { apiKey, apiSecret, userId } = req.query;
  if (!apiKey || !apiSecret || !userId) return res.status(400).json({ error: "Missing params" });

  const authHeader = `Basic ${Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString('base64')}`;

  try {
    const [summaryRes, positionsRes] = await Promise.all([
      fetch(`https://live.trading212.com/api/v0/equity/account/summary`, { headers: { 'Authorization': authHeader } }),
      fetch(`https://live.trading212.com/api/v0/equity/positions`, { headers: { 'Authorization': authHeader } })
    ]);

    if (!summaryRes.ok || !positionsRes.ok) throw new Error("T212 Auth Failed");

    const summary = await summaryRes.json();
    const portfolio = await positionsRes.json();

    const today = new Date().toISOString().split('T')[0];
    const totalValue = summary.totalValue;

    // 1. Snapshot History for any user
    const userRef = db.collection('users').doc(userId);
    await userRef.collection('history').doc(today).set({
      date: today,
      balance: totalValue,
      invested: summary.investments.totalCost,
    }, { merge: true });

    // 2. Fetch Dividends and History from Firestore
    const [histSnap, divSnap] = await Promise.all([
      userRef.collection('history').orderBy('date', 'asc').get(),
      userRef.collection('dividends').get()
    ]);

    let totalDivs = 0;
    const divsByTicker = {};
    divSnap.forEach(doc => {
      const d = doc.data();
      totalDivs += (Number(d.amount) || 0);
      divsByTicker[d.ticker] = (divsByTicker[d.ticker] || 0) + (Number(d.amount) || 0);
    });

    const historyData = histSnap.docs.map(doc => ({
      date: doc.data().date,
      balanceVal: doc.data().balance,
      investedVal: doc.data().invested
    }));

    // 3. Map Positions (Matches your App.jsx expectations)
    const positions = portfolio.map(p => ({
      name: p.instrument.name,
      ticker: p.instrument.ticker,
      quantity: p.quantity,
      avgPrice: p.averagePricePaid,
      currPrice: p.currentPrice,
      invested: p.walletImpact.totalCost,
      value: p.walletImpact.currentValue,
      profit: p.walletImpact.unrealizedProfitLoss,
      percent: p.walletImpact.totalCost > 0 ? (p.walletImpact.unrealizedProfitLoss / p.walletImpact.totalCost) : 0,
      dividendPaid: divsByTicker[p.instrument.ticker] || 0
    }));

    // 4. Final Data Structure (CZK/Universal)
    return res.status(200).json({
      accountSummary: {
        totalValue: totalValue,
        portfolioValue: summary.investments.currentValue,
        freeCash: summary.cash.availableToTrade,
        totalPL: summary.investments.unrealizedProfitLoss,
        totalDividends: totalDivs,
        divsMonthly2025: 0,
        divsMonthly2026: 0
      },
      allPositions: positions,
      pies: [], 
      allocations: {
        market: positions.map(p => ({ name: p.name, value: p.value })).sort((a,b) => b.value - a.value).slice(0, 8),
        sector: [],
        currency: []
      },
      charts: { history: historyData, dividends: [], invested: [] }
    });

  } catch (error) {
    return res.status(500).json({ error: "Sync Failed", details: error.message });
  }
}