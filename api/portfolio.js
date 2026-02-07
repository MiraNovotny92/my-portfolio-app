import admin from 'firebase-admin';

// --- 1. ROBUST FIREBASE INITIALIZATION ---
// This specific fix handles the Vercel environment variable formatting issues
if (!admin.apps.length) {
  try {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";
    // If the key comes in with literal "\n" characters (common in Vercel), replace them with real newlines
    const privateKey = rawKey.replace(/\\n/g, '\n').replace(/"/g, '').trim();

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log("Firebase initialized successfully");
  } catch (e) {
    console.error("Firebase Init Error:", e.message);
  }
}

export default async function handler(req, res) {
  const { apiKey, apiSecret, userId } = req.query;

  // Basic Validation
  if (!apiKey || !apiSecret || !userId) {
    console.error("Missing params in request");
    return res.status(400).json({ error: "Missing params" });
  }

  const authHeader = `Basic ${Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`).toString('base64')}`;

  try {
    console.log(`Fetching data for user: ${userId}`);

    // --- 2. FETCH LIVE DATA ---
    const [summaryRes, positionsRes, divRes] = await Promise.all([
      fetch(`https://live.trading212.com/api/v0/equity/account/summary`, {
        headers: { 'Authorization': authHeader }
      }),
      fetch(`https://live.trading212.com/api/v0/equity/positions`, {
        headers: { 'Authorization': authHeader }
      }),
      // We fetch dividends in parallel now to speed it up
      fetch(`https://live.trading212.com/api/v0/equity/history/dividends?limit=50`, { 
        headers: { 'Authorization': authHeader } 
      })
    ]);

    if (!summaryRes.ok || !positionsRes.ok) {
        console.error(`T212 Error - Summary: ${summaryRes.status}, Positions: ${positionsRes.status}`);
        return res.status(401).json({ error: "T212 Connection Failed (Check API Key)" });
    }

    const summary = await summaryRes.json();
    const portfolio = await positionsRes.json();
    
    // Database Setup
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    const today = new Date().toISOString().split('T')[0];

    // --- 3. SYNC DIVIDENDS (If successful) ---
    if (divRes.ok) {
        try {
            const divData = await divRes.json();
            const batch = db.batch();
            divData.items.forEach(item => {
                const dRef = userRef.collection('dividends').doc(String(item.reference));
                batch.set(dRef, {
                    ticker: item.ticker,
                    amount: Number(item.amount),
                    date: item.paidOn,
                    type: item.type
                }, { merge: true });
            });
            await batch.commit();
            console.log("Dividends synced successfully");
        } catch (e) { console.warn("Dividend DB Sync warning:", e.message); }
    }

    // --- 4. MASTER ACCOUNTING & DB CALCULATIONS ---
    const totalValue = summary.totalValue; 
    const totalInvested = summary.investments.totalCost;
    const totalPL = (summary.investments.unrealizedProfitLoss + summary.investments.realizedProfitLoss);
    const freeCash = summary.cash.availableToTrade;

    let historyData = [];
    let totalDivsReceived = 0;
    
    // RESTORED: Your specific 2025/2026 Logic for the Summary Card
    let divs2025 = 0;
    let divs2026 = 0;
    let divsForChart = [];

    try {
        // Save History Snapshot
        await userRef.collection('history').doc(today).set({
            date: today,
            balance: totalValue,
            invested: totalInvested,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Fetch Historical Data for Charts
        const [histSnap, divSnap] = await Promise.all([
            userRef.collection('history').orderBy('date', 'asc').limit(100).get(),
            userRef.collection('dividends').orderBy('date', 'asc').get()
        ]);

        historyData = histSnap.docs.map(doc => ({
            date: doc.data().date,
            balance: doc.data().balance,
            invested: doc.data().invested
        }));

        // --- DIVIDEND MATH ---
        let runningTotal = 0;
        divSnap.forEach(doc => { 
            const d = doc.data();
            const amt = Number(d.amount) || 0;
            const year = new Date(d.date).getFullYear();
            
            runningTotal += amt;
            totalDivsReceived += amt;
            
            // Your logic for the Summary Card
            if (year === 2025) divs2025 += amt;
            if (year === 2026) divs2026 += amt;

            divsForChart.push({ date: d.date, total: runningTotal });
        });
    } catch (dbErr) {
        console.error("Database Calculation Error:", dbErr);
        // Fallback if DB fails
        historyData = [{ date: today, balance: totalValue, invested: totalInvested }];
    }

    // Calculate Monthly Averages (Restored for your Summary Card)
    const currentMonth = new Date().getMonth() + 1; 
    const avg2025 = divs2025 / 12; 
    const avg2026 = divs2026 / currentMonth; 

    // --- 5. ALLOCATIONS (Restored your Logic) ---
    const marketGroups = {};
    const sectorGroups = {};
    const currencyGroups = {};

    const positions = portfolio.map(pos => {
        const val = pos.walletImpact.currentValue;
        const ticker = pos.instrument.ticker;
        const cur = pos.instrument.currency === "GBX" ? "GBP" : (pos.instrument.currency || "USD");

        // Your Custom Market Logic
        let market = "Other Markets";
        if (ticker.includes("_US_EQ") || cur === "USD") market = "US Market 🇺🇸";
        else if (ticker.includes("_UK_EQ") || cur === "GBP" || ticker.endsWith("l_EQ")) market = "London 🇬🇧";
        else if (cur === "EUR") {
            if (ticker.endsWith("p_EQ")) market = "Paris 🇫🇷";
            else if (ticker.endsWith("d_EQ")) market = "Xetra 🇩🇪";
            else market = "Europe 🇪🇺";
        }
        marketGroups[market] = (marketGroups[market] || 0) + val;

        // Your Custom Sector Logic
        let sector = "Individual Stocks";
        if (pos.instrument.name.match(/MSCI|Vanguard|Acc|ETF/i)) sector = "Diversified (ETFs)";
        sectorGroups[sector] = (sectorGroups[sector] || 0) + val;
        currencyGroups[cur] = (currencyGroups[cur] || 0) + val;

        return {
            name: pos.instrument.name,
            ticker: pos.instrument.ticker,
            quantity: pos.quantity,
            avgPrice: pos.averagePricePaid,
            currPrice: pos.currentPrice,
            invested: pos.walletImpact.totalCost,
            value: val,
            profit: pos.walletImpact.unrealizedProfitLoss,
            percent: pos.walletImpact.totalCost > 0 ? (pos.walletImpact.unrealizedProfitLoss / pos.walletImpact.totalCost) : 0,
            dividendPaid: 0
        };
    });

    const formatAlloc = (group) => Object.keys(group).map(name => ({ name, value: group[name] })).sort((a,b) => b.value - a.value);

    // --- 6. FINAL RESPONSE ---
    res.status(200).json({
        accountSummary: {
            totalValue,
            totalInvested,
            freeCash,
            totalPL,
            totalDividends: totalDivsReceived,
            divsMonthly2025: avg2025, // Kept this for your SummaryCard
            divsMonthly2026: avg2026  // Kept this for your SummaryCard
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

  } catch (error) { 
      console.error("Critical API Handler Error:", error);
      res.status(500).json({ error: "Server Error", details: error.message }); 
  }
}