import admin from 'firebase-admin';

// 1. SAFE INITIALIZATION
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // This is the common failure point - we fix it here
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
} catch (e) {
  console.error("Firebase Init Error:", e.message);
}

const db = admin.firestore();

export default async function handler(req, res) {
  const { apiKey, apiSecret, userId } = req.query;

  if (!apiKey || !apiSecret || !userId) {
    return res.status(400).json({ 
      error: "Missing Parameters", 
      debug_info: { details: `Key: ${!!apiKey}, Secret: ${!!apiSecret}, UID: ${!!userId}` } 
    });
  }

  const authHeader = `Basic ${Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString('base64')}`;

  try {
    // 2. FETCH T212 DATA (We know this part works!)
    const [summaryRes, positionsRes] = await Promise.all([
      fetch(`https://live.trading212.com/api/v0/equity/account/summary`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      }),
      fetch(`https://live.trading212.com/api/v0/equity/positions`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      })
    ]);

    if (!summaryRes.ok || !positionsRes.ok) {
      throw new Error(`T212 Rejected Connection: ${summaryRes.status}`);
    }

    const summary = await summaryRes.json();
    const portfolio = await positionsRes.json();

    const totalValue = summary.cash.total + summary.investments.currentValue;
    const totalInvested = summary.investments.totalCost;
    const today = new Date().toISOString().split('T')[0];

    // 3. ATTEMPT DATABASE SAVE (Wrapped so it doesn't crash the UI if it fails)
    let historyData = [];
    try {
      const historyRef = db.collection('users').doc(userId).collection('history');
      const todayDoc = await historyRef.doc(today).get();
      
      if (!todayDoc.exists) {
        await historyRef.doc(today).set({
          date: today,
          balance: totalValue,
          invested: totalInvested,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      const snapshot = await historyRef.orderBy('date', 'asc').limit(100).get();
      historyData = snapshot.docs.map(doc => doc.data());
    } catch (dbError) {
      console.error("Database Error:", dbError.message);
      // We keep going so you at least see your live balance!
    }

    // 4. MAP DATA
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

    res.status(200).json({
      accountSummary: {
        totalValue: totalValue,
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
      charts: { invested: [], dividends: [], history: historyData }
    });

  } catch (error) {
    res.status(500).json({ error: "Sync Failed", debug_info: { details: error.message } });
  }
}