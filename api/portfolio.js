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
  } catch (e) {
    console.error("Firebase Init Error:", e.message);
  }
}

export default async function handler(req, res) {
  const { apiKey, apiSecret, userId } = req.query;

  if (!apiKey || !apiSecret || !userId) {
    return res.status(400).json({ error: "Missing Key, Secret, or UID" });
  }

  const authHeader = `Basic ${Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString('base64')}`;

  try {
    const [summaryRes, positionsRes] = await Promise.all([
      fetch(`https://live.trading212.com/api/v0/equity/account/summary`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      }),
      fetch(`https://live.trading212.com/api/v0/equity/positions`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      })
    ]);

    if (!summaryRes.ok || !positionsRes.ok) {
      return res.status(401).json({ error: "T212 Connection Failed" });
    }

    const summary = await summaryRes.json();
    const portfolio = await positionsRes.json();

    // --- MATH FIXES TO MATCH YOUR RAW DATA ---
    const totalValue = summary.totalValue; // Use the direct field from T212
    const totalInvested = summary.investments.totalCost;
    const totalPL = summary.investments.unrealizedProfitLoss;
    const freeCash = summary.cash.availableToTrade;
    const today = new Date().toISOString().split('T')[0];

    let historyData = [];
    try {
      const db = admin.firestore();
      const historyRef = db.collection('users').doc(userId).collection('history');
      
      await historyRef.doc(today).set({
        date: today,
        balance: totalValue,
        invested: totalInvested,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const snapshot = await historyRef.orderBy('date', 'asc').limit(100).get();
      historyData = snapshot.docs.map(doc => ({
        dateLabel: doc.data().date,
        balanceVal: doc.data().balance,
        investedVal: doc.data().invested
      }));
    } catch (dbErr) {
      historyData = [{ dateLabel: today, balanceVal: totalValue, investedVal: totalInvested }];
    }

    // --- POSITION MAPPING ---
    const positions = portfolio.map(pos => ({
      name: pos.instrument.name || pos.instrument.ticker,
      ticker: pos.instrument.ticker,
      quantity: pos.quantity,
      avgPrice: pos.averagePricePaid,
      currPrice: pos.currentPrice,
      invested: pos.walletImpact.totalCost, // CZK Cost
      value: pos.walletImpact.currentValue, // CZK Value
      profit: pos.walletImpact.unrealizedProfitLoss, // CZK Profit
      percent: pos.walletImpact.totalCost > 0 ? (pos.walletImpact.unrealizedProfitLoss / pos.walletImpact.totalCost) : 0,
      dividendPaid: 0
    }));

    res.status(200).json({
      accountSummary: {
        totalValue,
        portfolioValue: summary.investments.currentValue,
        freeCash,
        totalPL,
        totalDividends: 247, // Hardcoded your current total for now
        divsMonthly2025: 18,
        divsMonthly2026: 24
      },
      allPositions: positions,
      pies: [], 
      allocations: {
        market: positions.map(p => ({ name: p.name, value: p.value })).sort((a,b) => b.value - a.value).slice(0, 8),
        sector: [],
        currency: []
      },
      charts: { invested: [], dividends: [], history: historyData }
    });

  } catch (error) {
    res.status(500).json({ error: "Server Error", details: error.message });
  }
}