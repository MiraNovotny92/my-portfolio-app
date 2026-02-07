// src/components/DividendsTab.jsx
import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, Tooltip, ResponsiveContainer 
} from 'recharts';

const DividendsTab = ({ chartData, theme }) => {
  const snowballData = useMemo(() => {
    return (chartData?.dividends || []).map(item => {
      const d = new Date(item.date);
      return {
        ...item,
        displayDate: !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : item.date,
        fullDate: !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : item.date
      };
    });
  }, [chartData]);

  const monthlyIncomeData = useMemo(() => {
    const raw = chartData?.dividends || [];
    if (!raw.length) return [];
    
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
        fullDate: dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      };
    });
  }, [chartData]);

  const yearlyStats = useMemo(() => {
    const raw = chartData?.dividends || [];
    if (raw.length === 0) return {};
    const getMaxInYear = (year) => {
      const entries = raw.filter(d => new Date(d.date).getFullYear() === year);
      return entries.length === 0 ? 0 : entries[entries.length - 1].total;
    };
    const total2024 = getMaxInYear(2024);
    const total2025 = getMaxInYear(2025) - (raw.some(d => new Date(d.date).getFullYear() === 2024) ? getMaxInYear(2024) : 0);
    const total2026 = getMaxInYear(2026) - getMaxInYear(2025);
    return {
      2024: { total: total2024, avg: total2024 / 12 },
      2025: { total: total2025, avg: total2025 / 12 },
      2026: { total: total2026, avg: total2026 / 1 }
    };
  }, [chartData]);

  const StatCard = ({ year, data, color }) => (
    <div style={{background: theme.card, padding: '16px', borderRadius: '20px', border: '1px solid ' + theme.border, flex: 1}}>
      <p style={{fontSize: '10px', color: theme.sub, fontWeight: 'bold', marginBottom: '4px'}}>{year} TOTAL</p>
      <p style={{fontSize: '18px', fontWeight: '900', color: color, margin: 0}}>{(data?.total || 0).toFixed(0)}</p>
      <div style={{marginTop: '8px', paddingTop: '8px', borderTop: '1px solid '+theme.border}}>
         <p style={{fontSize: '9px', color: theme.sub}}>MONTHLY AVG</p>
         <p style={{fontSize: '12px', fontWeight: 'bold'}}>{(data?.avg || 0).toFixed(1)}</p>
      </div>
    </div>
  );

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', 
        padding: '30px', 
        borderRadius: '32px', 
        color: '#fff', 
        boxShadow: '0 10px 30px -10px rgba(16, 185, 129, 0.5)'
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px'}}>
          <TrendingUp size={20} color="#fff" style={{opacity: 0.8}}/>
          <p style={{fontSize: '11px', opacity: 0.9, fontWeight: 'bold', letterSpacing: '1px'}}>DIVIDEND SNOWBALL</p>
        </div>
        <h2 style={{fontSize: '42px', fontWeight: '900', margin: '0'}}>
          {(chartData?.dividends?.length > 0 ? chartData.dividends[chartData.dividends.length-1].total : 0).toLocaleString()} 
          <span style={{fontSize: '16px', opacity: 0.8}}> CZK</span>
        </h2>
        <p style={{fontSize: '12px', opacity: 0.8, marginTop: '4px'}}>Cumulative Passive Income</p>
      </div>
      
      <div style={{display: 'flex', gap: '12px'}}>
        <StatCard year="2024" data={yearlyStats[2024]} color={theme.sub} />
        <StatCard year="2025" data={yearlyStats[2025]} color="#3b82f6" />
        <StatCard year="2026" data={yearlyStats[2026]} color="#10b981" />
      </div>

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