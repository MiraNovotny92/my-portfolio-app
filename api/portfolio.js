import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // The replace handles the newlines from your Vercel Env Var
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  const { apiKey, apiSecret, userId } = req.query;

  if (!apiKey || !apiSecret || !userId) {
    return res.status(400).json({ error: "Missing required parameters (Key, Secret, or UID)" });
  }

  const authHeader = `Basic ${Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString('base64')}`;

  const fetchT212 = async (subdomain, endpoint) => {
    const url = `https://${subdomain}.trading212.com/api/v0/equity/${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`T212 Error ${response.status}: ${text.substring(0, 100)}`);
    }
    return await response.json();
  };

  try {
    const summary = await fetchT212('live', 'account/summary');
    const portfolio = await fetchT212('live', 'positions');

    const totalValue = summary.cash.total + summary.investments.currentValue;
    const totalInvested = summary.investments.totalCost;
    const today = new Date().toISOString().split('T')[0];

    // --- FIREBASE HISTORY LOGIC ---
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

    const snapshot = await historyRef.orderBy('date', 'asc').get();
    const historyData = snapshot.docs.map(doc => doc.data());
    // ------------------------------

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
      charts: { 
        invested: [], 
        dividends: [], 
        history: historyData 
      }
    };

    return res.status(200).json(dashboardData);

  } catch (error) {
    return res.status(500).json({ error: "Sync Failed", debug_info: { details: error.message } });
  }
}