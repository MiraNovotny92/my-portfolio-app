// TEMPORARY DEBUG SCRIPT
export default async function handler(req, res) {
  const { apiKey, apiSecret } = req.query;
  const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;

  try {
    const [summaryRes, positionsRes] = await Promise.all([
      fetch(`https://live.trading212.com/api/v0/equity/account/summary`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      }),
      fetch(`https://live.trading212.com/api/v0/equity/positions`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      })
    ]);

    const summary = await summaryRes.json();
    const portfolio = await positionsRes.json();

    // THIS IS THE KEY: We send the raw data so we can see the exact field names
    return res.status(200).json({
      DEBUG_RAW_SUMMARY: summary,
      DEBUG_RAW_PORTFOLIO: portfolio
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}