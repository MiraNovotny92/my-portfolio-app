import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, Tooltip, ResponsiveContainer 
} from 'recharts';

const DividendsTab = ({ chartData, theme }) => {
  // 1. Process Chart Data
  const snowballData = useMemo(() => {
    return (chartData?.dividends || []).map(item => {
      const d = new Date(item.date);
      return {
        ...item,
        displayDate: !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : item.date,
      };
    });
  }, [chartData]);

  // 2. Process Monthly Bars
  const monthlyIncomeData = useMemo(() => {
    const raw = chartData?.dividends || [];
    if (!raw.length) return [];
    
    // Calculate differences between cumulative totals to get individual payments
    const increments = raw.map((item, i) => {
       const prevTotal = i > 0 ? raw[i-1].total : 0;
       const amount = item.total - prevTotal;
       return { date: item.date, amount: amount > 0 ? amount : 0 };
    });

    const grouped = {};
    increments.forEach(item => {
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = { amount: 0, dateObj: d };
      grouped[key].amount += item.amount;
    });

    return Object.keys(grouped).sort().map(key => {
      const { amount, dateObj } = grouped[key];
      return {
        amount,
        displayDate: dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      };
    });
  }, [chartData]);

  // 3. DYNAMIC YEARLY STATS (The Fix)
  const yearlyStats = useMemo(() => {
    const raw = chartData?.dividends || [];
    if (raw.length === 0) return [];

    // Calculate individual payments first
    const payments = raw.map((item, i) => {
       const prevTotal = i > 0 ? raw[i-1].total : 0;
       return { date: item.date, amount: item.total - prevTotal };
    });

    // Group by Year
    const byYear = {};
    payments.forEach(p => {
        const year = new Date(p.date).getFullYear();
        if (!byYear[year]) byYear[year] = 0;
        byYear[year] += p.amount;
    });

    // Determine current month for averaging
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Convert to Array and Sort Descending (Newest Year First)
    return Object.keys(byYear).sort((a,b) => b - a).map(year => {
        const y = parseInt(year);
        const total = byYear[year];
        let divisor = 12;
        if (y === currentYear) divisor = currentMonth; // Average over months passed so far
        if (y > currentYear) divisor = 1; // Future year edge case

        return { year: y, total, avg: total / divisor };
    });
  }, [chartData]);

  const StatCard = ({ year, total, avg }) => (
    <div style={{background: theme.card, padding: '16px', borderRadius: '20px', border: '1px solid ' + theme.border, minWidth: '100px', flex: 1}}>
      <p style={{fontSize: '10px', color: theme.sub, fontWeight: 'bold', marginBottom: '4px'}}>{year} TOTAL</p>
      <p style={{fontSize: '18px', fontWeight: '900', color: theme.text, margin: 0}}>{(total || 0).toFixed(0)}</p>
      <div style={{marginTop: '8px', paddingTop: '8px', borderTop: '1px solid '+theme.border}}>
         <p style={{fontSize: '9px', color: theme.sub}}>MONTHLY AVG</p>
         <p style={{fontSize: '12px', fontWeight: 'bold', color: '#10b981'}}>{(avg || 0).toFixed(1)}</p>
      </div>
    </div>
  );

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
      {/* HEADER CARD */}
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', padding: '30px', 
        borderRadius: '32px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(16, 185, 129, 0.5)'
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px'}}>
          <TrendingUp size={20} color="#fff" style={{opacity: 0.8}}/>
          <p style={{fontSize: '11px', opacity: 0.9, fontWeight: 'bold', letterSpacing: '1px'}}>DIVIDEND SNOWBALL</p>
        </div>
        <p style={{margin: 0, fontWeight: '900'}}>{(summary.totalDividends || 0).toLocaleString()}</p>
        <h2 style={{fontSize: '42px', fontWeight: '900', margin: '0'}}>
          {(chartData?.dividends?.length > 0 ? chartData.dividends[chartData.dividends.length-1].total : 0).toLocaleString()} 
          <span style={{fontSize: '16px', opacity: 0.8}}> CZK</span>
        </h2>
        <p style={{fontSize: '12px', opacity: 0.8, marginTop: '4px'}}>Cumulative Passive Income</p>
      </div>
      
      {/* DYNAMIC YEARS ROW */}
      <div style={{display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px'}}>
        {yearlyStats.length > 0 ? (
            yearlyStats.map(stat => (
                <StatCard key={stat.year} year={stat.year} total={stat.total} avg={stat.avg} />
            ))
        ) : (
            <div style={{width:'100%', textAlign:'center', padding:'20px', color: theme.sub, fontSize:'12px', border:'1px dashed '+theme.border, borderRadius:'12px'}}>
                No dividend history found.
            </div>
        )}
      </div>

      {/* MONTHLY CHART */}
      <div style={{background: theme.card, padding: '20px', borderRadius: '28px', border: '1px solid ' + theme.border}}>
        <h3 style={{fontSize: '11px', fontWeight: 'bold', color: theme.sub, marginBottom: '20px', textAlign: 'center'}}>MONTHLY INCOME HISTORY</h3>
        <div style={{height: '220px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyIncomeData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} opacity={0.3} />
              <XAxis dataKey="displayDate" stroke={theme.sub} fontSize={10} tickLine={false} axisLine={true} minTickGap={10} />
              <YAxis stroke={theme.sub} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}/>
              <Tooltip 
                cursor={{fill: theme.text, opacity: 0.05}} 
                contentStyle={{background: theme.card, border: '1px solid '+theme.border, borderRadius: '12px'}} 
                labelStyle={{color: theme.text, fontWeight: 'bold'}} 
                itemStyle={{color: '#10b981'}} 
                formatter={(value) => [value.toLocaleString() + ' CZK', 'Income']}
              />
              <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CUMULATIVE CHART */}
      <div style={{background: theme.card, padding: '20px', borderRadius: '28px', border: '1px solid ' + theme.border}}>
        <h3 style={{fontSize: '11px', fontWeight: 'bold', color: theme.sub, marginBottom: '20px', textAlign: 'center'}}>CUMULATIVE GROWTH</h3>
        <div style={{height: '220px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={snowballData} margin={{ left: -10, right: 10 }}>
              <defs>
                <linearGradient id="colorDivs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} opacity={0.3} />
              <XAxis dataKey="displayDate" stroke={theme.sub} fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis stroke={theme.sub} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}/>
              <Tooltip 
                contentStyle={{background: theme.card, border: '1px solid '+theme.border, borderRadius: '12px'}} 
                labelStyle={{color: theme.text, fontWeight: 'bold'}} 
                itemStyle={{color: '#10b981'}} 
                formatter={(value) => [value.toLocaleString() + ' CZK', 'Total Income']}
              />
              <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorDivs)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DividendsTab;