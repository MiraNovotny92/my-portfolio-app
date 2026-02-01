import admin from 'firebase-admin';

const cleanKey = (key) => {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n').replace(/"/g, '').trim();
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: cleanKey(process.env.FIREBASE_PRIVATE_KEY),
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
    // 1. Fetch Summary & Positions (The Basics)
    const [summaryRes, positionsRes, piesListRes] = await Promise.all([
      fetch(`https://live.trading212.com/api/v0/equity/account/summary`, { headers: { 'Authorization': authHeader } }),
      fetch(`https://live.trading212.com/api/v0/equity/positions`, { headers: { 'Authorization': authHeader } }),
      fetch(`https://live.trading212.com/api/v0/equity/pies`, { headers: { 'Authorization': authHeader } })
    ]);

    const summary = await summaryRes.json();
    const positionsRaw = await positionsRes.json();
    const piesList = await piesListRes.json();

    const today = new Date().toISOString().split('T')[0];
    const totalValue = summary.totalValue;
    const totalInvested = summary.investments.totalCost;

    // 2. Fetch Dividends from Firestore (Porting your "Dividends" sheet logic)
    // We assume you have a 'dividends' collection where you log payouts
    const divsSnapshot = await db.collection('users').doc(userId).collection('dividends').get();
    let totalDividends = 0;
    let divsByTicker = {};
    let divsHistory = [];

    divsSnapshot.forEach(doc => {
      const d = doc.data();
      totalDividends += d.amount;
      divsByTicker[d.ticker] = (divsByTicker[d.ticker] || 0) + d.amount;
      divsHistory.push({ date: d.date, total: totalDividends }); // For the Snowball
    });

    // 3. Map Positions with your Sector Logic
    const positions = positionsRaw.map(p => {
      const isETF = p.instrument.name.includes("ETF") || p.instrument.name.includes("Factor") || p.instrument.name.includes("World");
      return {
        name: p.instrument.name,
        ticker: p.instrument.ticker,
        quantity: p.quantity,
        avgPrice: p.averagePricePaid,
        currPrice: p.currentPrice,
        invested: p.walletImpact.totalCost,
        value: p.walletImpact.currentValue,
        profit: p.walletImpact.unrealizedProfitLoss,
        percent: p.walletImpact.totalCost > 0 ? (p.walletImpact.unrealizedProfitLoss / p.walletImpact.totalCost) : 0,
        dividendPaid: divsByTicker[p.instrument.ticker] || 0,
        sector: isETF ? "Diversified (ETFs)" : "Individual Stocks"
      };
    });

    // 4. Save History Snapshot (Time Machine)
    const historyRef = db.collection('users').doc(userId).collection('history');
    await historyRef.doc(today).set({
      date: today,
      balance: totalValue,
      invested: totalInvested,
    }, { merge: true });

    const histSnapshot = await historyRef.orderBy('date', 'asc').get();
    const historyData = histSnapshot.docs.map(doc => ({
      date: doc.data().date,
      balance: doc.data().balance,
      invested: doc.data().invested
    }));

    // 5. Construct Final Dashboard Object for App.jsx
    res.status(200).json({
      accountSummary: {
        totalValue: totalValue,
        portfolioValue: summary.investments.currentValue,
        freeCash: summary.cash.availableToTrade,
        totalPL: summary.investments.unrealizedProfitLoss,
        totalDividends: totalDividends,
        divsMonthly2025: totalDividends / 12, // Simple proxy for now
        divsMonthly2026: 0
      },
      allPositions: positions,
      pies: piesList.map(pie => ({
        name: pie.name || `Pie ${pie.id}`,
        value: 0, // In v0, summary pie value isn't in the list, requires deep fetch
        invested: 0,
        profit: 0,
        returnPct: 0
      })),
      allocations: {
        market: positions.map(p => ({ name: p.name, value: p.value })).sort((a,b) => b.value - a.value).slice(0, 5),
        sector: [
          { name: "Stocks", value: positions.filter(p => p.sector === "Individual Stocks").reduce((s, p) => s + p.value, 0) },
          { name: "ETFs", value: positions.filter(p => p.sector === "Diversified (ETFs)").reduce((s, p) => s + p.value, 0) }
        ],
        currency: [
          { name: "USD", value: positions.filter(p => p.ticker.includes("US")).reduce((s, p) => s + p.value, 0) },
          { name: "CZK/Other", value: positions.filter(p => !p.ticker.includes("US")).reduce((s, p) => s + p.value, 0) }
        ]
      },
      charts: { 
        invested: [], 
        dividends: divsHistory, 
        history: historyData 
      }
    });

  } catch (error) {
    res.status(500).json({ error: "Sync Failed", details: error.message });
  }
}