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
  } catch (e) {
    console.error("Firebase Init Error:", e.message);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  const { apiKey, apiSecret, userId } = req.query;

  if (!apiKey || !apiSecret || !userId) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const authHeader = `Basic ${Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString('base64')}`;

  try {
    // 1. Fetch Live Data from T212
    const [summaryRes, positionsRes] = await Promise.all([
      fetch(`https://live.trading212.com/api/v0/equity/account/summary`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      }),
      fetch(`https://live.trading212.com/api/v0/equity/positions`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      })
    ]);

    if (!summaryRes.ok || !positionsRes.ok) throw new Error("T212 Connection Failed");

    const summary = await summaryRes.json();
    const portfolio = await positionsRes.json();

    const totalValue = summary.cash.total + summary.investments.currentValue;
    const totalInvested = summary.investments.totalCost;
    const today = new Date().toISOString().split('T')[0];

    // 2. REAL DATABASE HISTORY (No Mocking)
    const historyRef = db.collection('users').doc(userId).collection('history');
    
    // Save today's snapshot
    await historyRef.doc(today).set({
      date: today,
      balance: totalValue,
      invested: totalInvested,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Fetch history for the Time Machine
    const snapshot = await historyRef.orderBy('date', 'asc').get();
    const historyData = snapshot.docs.map(doc => ({
      dateLabel: doc.data().date,
      balanceVal: doc.data().balance,
      investedVal: doc.data().invested
    }));

    // 3. MAP POSITIONS
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
      dividendPaid: 0 // API v0 doesn't track per-stock dividends easily
    }));

    // 4. PREPARE DASHBOARD JSON
    res.status(200).json({
      accountSummary: {
        totalValue: totalValue,
        portfolioValue: summary.investments.currentValue,
        freeCash: summary.cash.availableToTrade,
        totalPL: summary.investments.unrealizedProfitLoss,
        totalDividends: 247, // You can update this or leave it 0 until we add a div-fetcher
        divsMonthly2025: 18.048,
        divsMonthly2026: 24.04
      },
      allPositions: positions,
      pies: [], 
      allocations: {
        // This dynamically calculates based on your ACTUAL stocks
        market: positions.map(p => ({ name: p.name, value: p.value })).sort((a,b) => b.value - a.value).slice(0,5),
        sector: [],
        currency: []
      },
      charts: { 
        invested: [], 
        dividends: [], 
        history: historyData // REAL data from Firestore
      }
    });

  } catch (error) {
    res.status(500).json({ error: "Sync Failed", debug_info: { details: error.message } });
  }
}