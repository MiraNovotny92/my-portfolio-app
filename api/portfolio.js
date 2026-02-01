import admin from 'firebase-admin';

// Initialize Firebase Admin safely for a production environment
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // The replace handles newlines correctly for Vercel deployment
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (e) {
    console.error("Firebase Initialization Error:", e.message);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  const { apiKey, apiSecret, userId } = req.query;

  // Basic security check for the API request
  if (!apiKey || !userId) {
    return res.status(400).json({ error: "Missing required credentials or User ID" });
  }

  const authHeader = `Basic ${Buffer.from(`${apiKey.trim()}:${apiSecret?.trim()}`).toString('base64')}`;

  try {
    // 1. Fetch live data from Trading 212
    const [summaryRes, positionsRes] = await Promise.all([
      fetch(`https://live.trading212.com/api/v0/equity/account/summary`, { 
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' } 
      }),
      fetch(`https://live.trading212.com/api/v0/equity/positions`, { 
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' } 
      })
    ]);

    if (!summaryRes.ok || !positionsRes.ok) {
      const errText = await summaryRes.text();
      throw new Error(`Trading 212 API Error: ${summaryRes.status} - ${errText.substring(0, 50)}`);
    }

    const summary = await summaryRes.json();
    const portfolio = await positionsRes.json();
    
    // Dynamically identify the user's account currency (Universal Support)
    const userCurrency = summary.currency || "USD";
    const totalValue = summary.totalValue;
    const today = new Date().toISOString().split('T')[0];

    // 2. Database Operations (User-Specific History)
    const userRef = db.collection('users').doc(userId);
    
    // Save daily snapshot for the history chart
    await userRef.collection('history').doc(today).set({
      date: today,
      balance: totalValue,
      invested: summary.investments.totalCost,
    }, { merge: true });

    // Fetch historical data for this specific user
    const [histSnap, divSnap] = await Promise.all([
      userRef.collection('history').orderBy('date', 'asc').limit(90).get(),
      userRef.collection('dividends').get()
    ]);

    // Calculate total dividends from user's manual/synced entries
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

    // 3. Map positions for the UI components
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

    // 4. Send the structured JSON response back to the frontend
    return res.status(200).json({
      accountSummary: {
        totalValue: totalValue,
        portfolioValue: summary.investments.currentValue,
        freeCash: summary.cash.availableToTrade,
        totalPL: summary.investments.unrealizedProfitLoss,
        totalDividends: totalDivs,
        currency: userCurrency,
        divsMonthly2025: 0,
        divsMonthly2026: 0
      },
      allPositions: positions,
      pies: [], 
      allocations: {
        market: positions.map(p => ({ name: p.name, value: p.value })).sort((a,b) => b.value - a.value).slice(0, 10),
        sector: [],
        currency: []
      },
      charts: { history: historyData, dividends: [], invested: [] }
    });

  } catch (error) {
    console.error("API Function Crash:", error.message);
    return res.status(500).json({ error: "Server sync failed", details: error.message });
  }
}