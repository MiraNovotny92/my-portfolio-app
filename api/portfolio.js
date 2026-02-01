import admin from 'firebase-admin';

// Helper to sanitize the private key from Vercel's environment
const formatPrivateKey = (key) => {
  if (!key) return undefined;
  // This catches keys that are wrapped in quotes or have escaped newlines
  return key.replace(/\\n/g, '\n').replace(/"/g, '');
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error.stack);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Use standard Node.js req.query
  const { apiKey, apiSecret, userId } = req.query;

  if (!apiKey || !apiSecret || !userId) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const authHeader = `Basic ${Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString('base64')}`;

  try {
    // 1. Fetch from T212
    const [summaryRes, positionsRes] = await Promise.all([
      fetch(`https://live.trading212.com/api/v0/equity/account/summary`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      }),
      fetch(`https://live.trading212.com/api/v0/equity/positions`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      })
    ]);

    if (!summaryRes.ok || !positionsRes.ok) {
      return res.status(401).json({ error: "T212 Authentication Failed" });
    }

    const summary = await summaryRes.json();
    const portfolio = await positionsRes.json();

    const totalValue = summary.cash.total + summary.investments.currentValue;
    const totalInvested = summary.investments.totalCost;
    const today = new Date().toISOString().split('T')[0];

    // 2. Database Snapshot (History)
    let historyData = [];
    try {
      const historyRef = db.collection('users').doc(userId).collection('history');
      
      // Save today's snapshot
      await historyRef.doc(today).set({
        date: today,
        balance: totalValue,
        invested: totalInvested,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Get history for chart
      const snapshot = await historyRef.orderBy('date', 'asc').limit(30).get();
      historyData = snapshot.docs.map(doc => ({
        dateLabel: doc.data().date,
        balanceVal: doc.data().balance,
        investedVal: doc.data().invested
      }));
    } catch (dbErr) {
      console.error("Firestore Error:", dbErr.message);
      // Fallback so the UI still loads even if DB fails
      historyData = [{ dateLabel: today, balanceVal: totalValue, investedVal: totalInvested }];
    }

    // 3. Map Positions for UI
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

    // 4. Return Final JSON
    return res.status(200).json({
      accountSummary: {
        totalValue,
        portfolioValue: summary.investments.currentValue,
        freeCash: summary.cash.availableToTrade,
        totalPL: summary.investments.unrealizedProfitLoss,
        totalDividends: 247, 
        divsMonthly2025: 18.048,
        divsMonthly2026: 24.04
      },
      allPositions: positions,
      pies: [], 
      allocations: {
        market: positions.map(p => ({ name: p.name, value: p.value })).sort((a,b) => b.value - a.value).slice(0, 6),
        sector: [],
        currency: []
      },
      charts: { invested: [], dividends: [], history: historyData }
    });

  } catch (error) {
    return res.status(500).json({ error: "Server Crash", details: error.message });
  }
}