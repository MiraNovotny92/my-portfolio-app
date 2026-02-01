import admin from 'firebase-admin';

// This function cleans the key regardless of how it was pasted
const cleanKey = (key) => {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n').replace(/"/g, '').trim();
};

// Initialize Firebase with a safety net
try {
  if (!admin.apps.length) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: cleanKey(process.env.FIREBASE_PRIVATE_KEY),
    };

    if (serviceAccount.projectId && serviceAccount.privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
  }
} catch (e) {
  console.error("Firebase Init Failed but continuing:", e.message);
}

const db = admin.firestore();

export default async function handler(req, res) {
  const { apiKey, apiSecret, userId } = req.query;

  if (!apiKey || !apiSecret || !userId) {
    return res.status(400).json({ error: "Missing Key, Secret, or UID" });
  }

  const authHeader = `Basic ${Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString('base64')}`;

  try {
    // 1. Fetch from T212 (The part we know works)
    const [summaryRes, positionsRes] = await Promise.all([
      fetch(`https://live.trading212.com/api/v0/equity/account/summary`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      }),
      fetch(`https://live.trading212.com/api/v0/equity/positions`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      })
    ]);

    if (!summaryRes.ok || !positionsRes.ok) {
      return res.status(401).json({ error: "T212 Auth Failed" });
    }

    const summary = await summaryRes.json();
    const portfolio = await positionsRes.json();
    const totalValue = summary.cash.total + summary.investments.currentValue;
    const totalInvested = summary.investments.totalCost;
    const today = new Date().toISOString().split('T')[0];

    // 2. Database Snapshot (Wrapped in its own try-catch so it doesn't crash the whole app)
    let historyData = [];
    try {
      if (admin.apps.length) {
        const historyRef = db.collection('users').doc(userId).collection('history');
        await historyRef.doc(today).set({
          date: today,
          balance: totalValue,
          invested: totalInvested,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        const snapshot = await historyRef.orderBy('date', 'asc').limit(100).get();
        historyData = snapshot.docs.map(doc => doc.data());
      }
    } catch (dbErr) {
      console.warn("DB Save skipped:", dbErr.message);
      // Fallback to one data point so the chart doesn't break
      historyData = [{ date: today, balance: totalValue, invested: totalInvested }];
    }

    // 3. Map Positions
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

    // 4. Return Data
    return res.status(200).json({
      accountSummary: {
        totalValue,
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
        market: positions.map(p => ({ name: p.name, value: p.value })).sort((a,b) => b.value - a.value).slice(0, 8),
        sector: [],
        currency: []
      },
      charts: { invested: [], dividends: [], history: historyData }
    });

  } catch (error) {
    return res.status(500).json({ error: "Server Error", details: error.message });
  }
}